import { prisma } from "./prisma";

export function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

export type ImportRowResult = {
  index: number;
  externalId?: string;
  status: "created" | "updated" | "failed";
  id?: string;
  error?: { code: string; message: string; field?: string };
};

export type ImportResult = {
  created: number;
  updated: number;
  failed: number;
  results: ImportRowResult[];
};

export async function processImportRows(
  rows: Record<string, string>[],
  effectiveShopId: string | null,
): Promise<ImportResult> {
  const results: ImportRowResult[] = [];
  let created = 0,
    updated = 0,
    failed = 0;
  const validSourceTypes = new Set(["LOCAL_PRINT", "OVERSEAS", "CUSTOM"]);
  const validRuleTypes = new Set(["FIXED", "COST_PLUS", "FREE", "DECAY"]);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const externalId = row.external_id?.trim() || undefined;
    try {
      const title = row.title?.trim();
      const description = row.description?.trim();
      const sourceType = row.source_type?.trim().toUpperCase();
      const priceStr = row.price?.trim();
      if (!title || title.length < 1 || title.length > 120)
        throw { code: "VALIDATION_ERROR", message: "title is required (1-120 chars)", field: "title" };
      if (!description || description.length < 1 || description.length > 5000)
        throw { code: "VALIDATION_ERROR", message: "description is required (1-5000 chars)", field: "description" };
      if (!sourceType || !validSourceTypes.has(sourceType))
        throw {
          code: "VALIDATION_ERROR",
          message: "source_type must be LOCAL_PRINT, OVERSEAS, or CUSTOM",
          field: "source_type",
        };
      if (!priceStr) throw { code: "VALIDATION_ERROR", message: "price is required", field: "price" };
      const price = parseFloat(priceStr);
      if (isNaN(price) || price < 0)
        throw { code: "VALIDATION_ERROR", message: "price must be a non-negative number", field: "price" };

      const category = row.category?.trim() || null;
      const currency = (row.currency?.trim() || "NZD").toUpperCase().slice(0, 3);
      const active = row.active?.trim().toLowerCase() !== "false";
      const ruleType = row.rule_type?.trim().toUpperCase() || null;

      if (ruleType && !validRuleTypes.has(ruleType))
        throw {
          code: "VALIDATION_ERROR",
          message: "rule_type must be FIXED, COST_PLUS, FREE, or DECAY",
          field: "rule_type",
        };

      let decaySchedule: object | null = null;
      if (ruleType === "DECAY") {
        const startDate = row.decay_start_date?.trim();
        const endDate = row.decay_end_date?.trim();
        const startPriceRaw = row.decay_start_price?.trim();
        const endPriceRaw = row.decay_end_price?.trim();
        const startPrice = startPriceRaw ? parseFloat(startPriceRaw) : NaN;
        const endPrice = endPriceRaw ? parseFloat(endPriceRaw) : NaN;
        if (!startDate || !endDate)
          throw {
            code: "DECAY_REQUIRES_SCHEDULE",
            message: "decay_start_date and decay_end_date are required for DECAY rule",
            field: "decay_start_date",
          };
        const s = new Date(startDate),
          e = new Date(endDate);
        if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s)
          throw {
            code: "INVALID_DATE_RANGE",
            message: "decay_end_date must be after decay_start_date",
            field: "decay_end_date",
          };
        decaySchedule = {
          startDate,
          endDate,
          startPrice: isNaN(startPrice) ? price : startPrice,
          endPrice: isNaN(endPrice) ? price : endPrice,
          curve: row.decay_curve?.trim() || "linear",
        };
      }

      let listingId: string;
      let wasUpdated = false;

      if (externalId && effectiveShopId) {
        const existing = await prisma.productListing.findUnique({
          where: { shopId_externalId: { shopId: effectiveShopId, externalId } },
        } as never);
        if (existing) {
          const upd = await prisma.productListing.update({
            where: { id: (existing as { id: string }).id },
            data: {
              title,
              description,
              category,
              sourceType: sourceType as never,
              price,
              currency,
              active,
            },
          } as never);
          listingId = (upd as { id: string }).id;
          wasUpdated = true;
        } else {
          const cr = await prisma.productListing.create({
            data: {
              externalId,
              shopId: effectiveShopId,
              title,
              description,
              category,
              sourceType: sourceType as never,
              price,
              currency,
              active,
            },
          } as never);
          listingId = (cr as { id: string }).id;
        }
      } else {
        const cr = await prisma.productListing.create({
          data: {
            externalId: externalId ?? null,
            shopId: effectiveShopId,
            title,
            description,
            category,
            sourceType: sourceType as never,
            price,
            currency,
            active,
          },
        } as never);
        listingId = (cr as { id: string }).id;
      }

      if (ruleType) {
        await prisma.pricingRule.deleteMany({ where: { listingId } });
        await prisma.pricingRule.create({
          data: { listingId, type: ruleType as never, decaySchedule: decaySchedule as never },
        } as never);
      }

      const successResult: ImportRowResult = {
        index: i,
        status: wasUpdated ? "updated" : "created",
        id: listingId,
      };
      if (externalId !== undefined) successResult.externalId = externalId;
      results.push(successResult);
      if (wasUpdated) updated++;
      else created++;
    } catch (err: unknown) {
      failed++;
      const e = err as { code?: string; message?: string; field?: string };
      const errorObj: ImportRowResult["error"] = {
        code: e.code ?? "INTERNAL_ERROR",
        message: e.message ?? "Unexpected error",
      };
      if (e.field !== undefined) errorObj!.field = e.field;
      const failResult: ImportRowResult = { index: i, status: "failed", error: errorObj };
      if (externalId !== undefined) failResult.externalId = externalId;
      results.push(failResult);
    }
  }
  return { created, updated, failed, results };
}
