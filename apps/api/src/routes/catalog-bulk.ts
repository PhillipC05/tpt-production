import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { Queue } from "bullmq";
import { prisma } from "../lib/prisma";
import { requireAdmin, getAuthToken, resolveApiKey, apiKeyHasScope } from "../lib/auth";
import { jsonError, safeEqual } from "../lib/errors";
import { dispatchWebhooks } from "../lib/webhooks";
import { parseCsvRow, processImportRows } from "../lib/import";
import { redisConnection } from "../lib/env";
import type { AppBindings } from "../types/hono";
import { idParamSchema } from "../schemas/common";
import {
  bulkCatalogBodySchema,
  bulkResponseSchema,
  importJobSchema,
  priceSheetBodySchema,
  priceSheetResponseSchema,
} from "../schemas/bulk";

const bulkCatalogRoute = createRoute({
  method: "post",
  path: "/catalog/bulk",
  operationId: "bulkUpsertCatalog",
  tags: ["catalog"],
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: bulkCatalogBodySchema } },
    },
  },
  responses: {
    200: {
      description: "All items created/updated",
      content: { "application/json": { schema: bulkResponseSchema } },
    },
    207: {
      description: "Partial success — some items failed",
      content: { "application/json": { schema: bulkResponseSchema } },
    },
    400: { description: "Validation error or all items failed" },
    401: { description: "Admin token or catalog:write API key required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const csvImportRoute = createRoute({
  method: "post",
  path: "/catalog/import/csv",
  operationId: "importCatalogCsv",
  tags: ["catalog"],
  responses: {
    200: {
      description: "Synchronous import complete (≤50 rows)",
      content: { "application/json": { schema: bulkResponseSchema } },
    },
    202: {
      description: "Async import queued (>50 rows)",
      content: {
        "application/json": {
          schema: z.object({ jobId: z.string(), message: z.string() }),
        },
      },
    },
    400: { description: "Invalid CSV or missing required columns" },
    401: { description: "Admin token or catalog:write API key required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const getImportJobRoute = createRoute({
  method: "get",
  path: "/catalog/import/jobs/{id}",
  operationId: "getImportJob",
  tags: ["catalog"],
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Import job status",
      content: { "application/json": { schema: importJobSchema } },
    },
    401: { description: "Authentication required" },
    404: { description: "Job not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const priceSheetRoute = createRoute({
  method: "put",
  path: "/shops/{id}/price-sheet",
  operationId: "upsertPriceSheet",
  tags: ["shops", "catalog"],
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: priceSheetBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Price sheet upserted successfully",
      content: { "application/json": { schema: priceSheetResponseSchema } },
    },
    207: {
      description: "Price sheet upserted with some listing failures",
      content: { "application/json": { schema: priceSheetResponseSchema } },
    },
    401: { description: "Authentication required" },
    403: { description: "Not authorized for this shop" },
    404: { description: "Shop not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

export function registerCatalogBulkRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(bulkCatalogRoute, async (c) => {
    const token = getAuthToken(c);
    const adminToken = process.env.ADMIN_API_TOKEN;
    const isAdmin =
      !!(adminToken && token && safeEqual(token, adminToken)) ||
      (!adminToken && process.env.NODE_ENV !== "production");
    let callerShopId: string | null = null;

    if (!isAdmin) {
      if (!token)
        return jsonError(c, "UNAUTHORIZED", 401, "Admin token or catalog:write API key required") as never;
      const apiKeyRecord = await resolveApiKey(token);
      if (!apiKeyRecord || !apiKeyHasScope(apiKeyRecord, "catalog:write")) {
        return jsonError(c, "UNAUTHORIZED", 401, "catalog:write scope required") as never;
      }
      const shop = await prisma.makerShop.findUnique({ where: { userId: apiKeyRecord.userId } });
      callerShopId = shop?.id ?? null;
    }

    const { items } = c.req.valid("json");
    const results: Array<{
      index: number;
      externalId?: string;
      status: "created" | "updated" | "failed";
      id?: string;
      error?: { code: string; message: string; field?: string };
    }> = [];
    let created = 0,
      updated = 0,
      failed = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as {
        externalId?: string;
        shopId?: string;
        title: string;
        description: string;
        category?: string;
        sourceType: string;
        price: number;
        currency: string;
        active: boolean;
        pricingRules?: Array<{
          type: string;
          decaySchedule?: {
            startDate: string;
            endDate: string;
            startPrice: number;
            endPrice: number;
            curve?: string;
          };
        }>;
      };
      const effectiveShopId = isAdmin ? (item.shopId ?? null) : callerShopId;

      if (!isAdmin && item.shopId && item.shopId !== callerShopId) {
        results.push({
          index: i,
          externalId: item.externalId,
          status: "failed",
          error: { code: "FORBIDDEN", message: "Cannot create listings for another shop" },
        } as never);
        failed++;
        continue;
      }

      try {
        if (item.pricingRules) {
          for (const rule of item.pricingRules) {
            if (rule.type === "DECAY" && !rule.decaySchedule) {
              throw {
                code: "DECAY_REQUIRES_SCHEDULE",
                message: "Decay rule requires a decaySchedule",
                field: "pricingRules",
              };
            }
            if (rule.decaySchedule) {
              const s = new Date(rule.decaySchedule.startDate);
              const e = new Date(rule.decaySchedule.endDate);
              if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
                throw {
                  code: "INVALID_DATE_RANGE",
                  message: "endDate must be after startDate",
                  field: "pricingRules.decaySchedule",
                };
              }
            }
          }
        }

        let listingId: string;
        let wasUpdated = false;

        if (item.externalId && effectiveShopId) {
          const existing = await prisma.productListing.findUnique({
            where: {
              shopId_externalId: { shopId: effectiveShopId, externalId: item.externalId },
            },
          } as never);
          if (existing) {
            const upd = await prisma.productListing.update({
              where: { id: (existing as { id: string }).id },
              data: {
                title: item.title,
                description: item.description,
                category: item.category ?? null,
                sourceType: item.sourceType as never,
                price: item.price,
                currency: item.currency,
                active: item.active,
              },
            } as never);
            listingId = (upd as { id: string }).id;
            wasUpdated = true;
          } else {
            const cr = await prisma.productListing.create({
              data: {
                externalId: item.externalId,
                shopId: effectiveShopId,
                title: item.title,
                description: item.description,
                category: item.category ?? null,
                sourceType: item.sourceType as never,
                price: item.price,
                currency: item.currency,
                active: item.active,
              },
            } as never);
            listingId = (cr as { id: string }).id;
          }
        } else {
          const cr = await prisma.productListing.create({
            data: {
              externalId: item.externalId ?? null,
              shopId: effectiveShopId,
              title: item.title,
              description: item.description,
              category: item.category ?? null,
              sourceType: item.sourceType as never,
              price: item.price,
              currency: item.currency,
              active: item.active,
            },
          } as never);
          listingId = (cr as { id: string }).id;
        }

        if (item.pricingRules && item.pricingRules.length > 0) {
          await prisma.pricingRule.deleteMany({ where: { listingId } });
          await prisma.pricingRule.createMany({
            data: item.pricingRules.map((r) => ({
              listingId,
              type: r.type as never,
              decaySchedule: (r.decaySchedule as never) ?? null,
            })),
          } as never);
        }

        results.push({
          index: i,
          externalId: item.externalId,
          status: wasUpdated ? "updated" : "created",
          id: listingId,
        } as never);
        if (wasUpdated) updated++;
        else created++;
      } catch (err: unknown) {
        failed++;
        const e = err as { code?: string; message?: string; field?: string };
        results.push({
          index: i,
          externalId: item.externalId,
          status: "failed",
          error: {
            code: e.code ?? "INTERNAL_ERROR",
            message: e.message ?? "Unexpected error",
            field: e.field,
          },
        } as never);
      }
    }

    const allFailed = failed === items.length;
    const status = allFailed ? 400 : failed > 0 ? 207 : 200;
    return c.json({ created, updated, failed, results } as never, status);
  });

  app.openapi(csvImportRoute, async (c) => {
    const token = getAuthToken(c);
    const adminToken = process.env.ADMIN_API_TOKEN;
    const isAdmin =
      !!(adminToken && token && safeEqual(token, adminToken)) ||
      (!adminToken && process.env.NODE_ENV !== "production");
    let callerShopId: string | null = null;

    if (!isAdmin) {
      if (!token)
        return jsonError(c, "UNAUTHORIZED", 401, "Admin token or catalog:write API key required") as never;
      const apiKeyRecord = await resolveApiKey(token);
      if (!apiKeyRecord || !apiKeyHasScope(apiKeyRecord, "catalog:write")) {
        return jsonError(c, "UNAUTHORIZED", 401, "catalog:write scope required") as never;
      }
      const shop = await prisma.makerShop.findUnique({ where: { userId: apiKeyRecord.userId } });
      callerShopId = shop?.id ?? null;
    }

    let rawText: string;
    try {
      const body = await c.req.parseBody();
      const file = body["file"];
      if (!file || typeof file === "string") {
        return jsonError(c, "MISSING_FILE", 400, "multipart field 'file' (CSV) is required") as never;
      }
      rawText = await (file as File).text();
    } catch {
      return jsonError(c, "PARSE_ERROR", 400, "Could not read multipart body") as never;
    }

    const lines = rawText
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((l) => l.trim());
    if (lines.length < 2) {
      return jsonError(
        c,
        "EMPTY_FILE",
        400,
        "CSV must have a header row and at least one data row",
      ) as never;
    }

    const headers = parseCsvRow(lines[0]!).map((h) =>
      h.trim().toLowerCase().replace(/\s+/g, "_"),
    );
    const requiredCols = ["title", "description", "source_type", "price"];
    const missingCols = requiredCols.filter((col) => !headers.includes(col));
    if (missingCols.length > 0) {
      return c.json(
        {
          error: {
            code: "MISSING_COLUMNS",
            message: "Required columns missing",
            missing: missingCols,
          },
        } as never,
        400,
      );
    }

    const dataRows = lines.slice(1).map((line) => {
      const vals = parseCsvRow(line);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });

    const ASYNC_THRESHOLD = 50;
    if (dataRows.length > ASYNC_THRESHOLD) {
      const importQueue = new Queue("import-queue", { connection: redisConnection });
      const job = await prisma.importJob.create({
        data: { shopId: callerShopId, status: "PENDING", totalRows: dataRows.length },
      } as never);
      const jobId = (job as { id: string }).id;
      await importQueue.add("csv-import", { jobId, rows: dataRows, shopId: callerShopId });
      return c.json(
        { jobId, message: `${dataRows.length} rows queued for async import` } as never,
        202,
      );
    }

    const result = await processImportRows(dataRows, callerShopId);
    const allFailed = result.failed === dataRows.length;
    const status = allFailed ? 400 : result.failed > 0 ? 207 : 200;
    return c.json(result as never, status);
  });

  app.openapi(getImportJobRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { id } = c.req.valid("param");
    const job = await prisma.importJob.findUnique({ where: { id } } as never);
    if (!job)
      return c.json({ error: { code: "NOT_FOUND", message: "Import job not found" } } as never, 404);

    const j = job as {
      id: string;
      shopId: string | null;
      status: string;
      totalRows: number;
      created: number;
      updated: number;
      failed: number;
      errorLog: unknown;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
    return c.json({
      id: j.id,
      shopId: j.shopId,
      status: j.status,
      totalRows: j.totalRows,
      created: j.created,
      updated: j.updated,
      failed: j.failed,
      errorLog: j.errorLog,
      completedAt: j.completedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    } as never);
  });

  app.openapi(priceSheetRoute, async (c) => {
    const { id: shopId } = c.req.valid("param");
    const token = getAuthToken(c);
    const adminToken = process.env.ADMIN_API_TOKEN;
    const isAdmin =
      !!(adminToken && token && safeEqual(token, adminToken)) ||
      (!adminToken && process.env.NODE_ENV !== "production");

    const shop = await prisma.makerShop.findUnique({ where: { id: shopId } });
    if (!shop)
      return c.json({ error: { code: "NOT_FOUND", message: "Shop not found" } } as never, 404);

    if (!isAdmin) {
      if (!token)
        return jsonError(c, "UNAUTHORIZED", 401, "Admin token or catalog:write API key required") as never;
      const apiKeyRecord = await resolveApiKey(token);
      if (!apiKeyRecord || !apiKeyHasScope(apiKeyRecord, "catalog:write")) {
        return jsonError(c, "UNAUTHORIZED", 401, "catalog:write scope required") as never;
      }
      if (apiKeyRecord.userId !== (shop as { userId: string }).userId) {
        return jsonError(c, "FORBIDDEN", 403, "This API key is not authorized for this shop") as never;
      }
    }

    const { capabilities, listings, removeUnlisted } = c.req.valid("json") as {
      capabilities: Array<{ material: string; machineType: string; category: string }>;
      listings: Array<{
        externalId: string;
        shopId?: string;
        title: string;
        description: string;
        category?: string;
        sourceType: string;
        price: number;
        currency: string;
        active: boolean;
        pricingRules?: Array<{ type: string; decaySchedule?: unknown }>;
      }>;
      removeUnlisted: boolean;
    };

    let capUpserted = 0;
    for (const cap of capabilities) {
      await prisma.shopCapability.upsert({
        where: {
          shopId_material_machineType_category: {
            shopId,
            material: cap.material,
            machineType: cap.machineType,
            category: cap.category,
          },
        },
        create: { shopId, material: cap.material, machineType: cap.machineType, category: cap.category },
        update: {},
      } as never);
      capUpserted++;
    }

    const presentExternalIds = listings.map((l) => l.externalId);
    const listingResults: Array<{
      index: number;
      externalId?: string;
      status: "created" | "updated" | "failed";
      id?: string;
      error?: { code: string; message: string; field?: string };
    }> = [];
    let created = 0,
      updated = 0,
      failed = 0;

    for (let i = 0; i < listings.length; i++) {
      const item = listings[i]!;
      try {
        const existing = await prisma.productListing.findUnique({
          where: { shopId_externalId: { shopId, externalId: item.externalId } },
        } as never);

        let listingId: string;
        let wasUpdated = false;

        if (existing) {
          const upd = await prisma.productListing.update({
            where: { id: (existing as { id: string }).id },
            data: {
              title: item.title,
              description: item.description,
              category: item.category ?? null,
              sourceType: item.sourceType as never,
              price: item.price,
              currency: item.currency,
              active: item.active,
            },
          } as never);
          listingId = (upd as { id: string }).id;
          wasUpdated = true;
        } else {
          const cr = await prisma.productListing.create({
            data: {
              externalId: item.externalId,
              shopId,
              title: item.title,
              description: item.description,
              category: item.category ?? null,
              sourceType: item.sourceType as never,
              price: item.price,
              currency: item.currency,
              active: item.active,
            },
          } as never);
          listingId = (cr as { id: string }).id;
        }

        if (item.pricingRules && item.pricingRules.length > 0) {
          await prisma.pricingRule.deleteMany({ where: { listingId } });
          await prisma.pricingRule.createMany({
            data: item.pricingRules.map((r) => ({
              listingId,
              type: r.type as never,
              decaySchedule: (r.decaySchedule as never) ?? null,
            })),
          } as never);
        }

        listingResults.push({
          index: i,
          externalId: item.externalId,
          status: wasUpdated ? "updated" : "created",
          id: listingId,
        } as never);
        if (wasUpdated) updated++;
        else created++;
      } catch (err: unknown) {
        failed++;
        const e = err as { code?: string; message?: string; field?: string };
        listingResults.push({
          index: i,
          externalId: item.externalId,
          status: "failed",
          error: {
            code: e.code ?? "INTERNAL_ERROR",
            message: e.message ?? "Unexpected error",
            field: e.field,
          },
        } as never);
      }
    }

    if (removeUnlisted && presentExternalIds.length > 0) {
      await prisma.productListing.updateMany({
        where: { shopId, externalId: { notIn: presentExternalIds } } as never,
        data: { active: false },
      } as never);
    }

    void dispatchWebhooks("catalog.price_sheet_updated", {
      shopId,
      created,
      updated,
      deactivated: removeUnlisted ? "all-not-listed" : 0,
    });

    const allFailed = failed === listings.length && listings.length > 0;
    const status = allFailed ? 400 : failed > 0 ? 207 : 200;
    return c.json(
      {
        capabilities: { upserted: capUpserted },
        listings: { created, updated, failed, results: listingResults },
      } as never,
      status,
    );
  });
}
