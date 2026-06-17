import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { featureFlags } from "@tpt/core/flags";
import type { ProductListing } from "@tpt/types";
import { prisma } from "../lib/prisma";
import { requireAdmin, getAuthToken, resolveApiKey, apiKeyHasScope } from "../lib/auth";
import { jsonError } from "../lib/errors";
import type { AppBindings } from "../types/hono";
import { idParamSchema } from "../schemas/common";
import {
  pricingRuleSchema,
  pricingRulesListSchema,
  pricingRuleInputSchema,
  replacePricingRulesBodySchema,
  ruleIdParamSchema,
  priceQueryParamsSchema,
  priceQueryResponseSchema,
  syncFeedQuerySchema,
} from "../schemas/pricing";
import { listingToResponse } from "../lib/mappers";
import { syncFeedResponseSchema } from "../schemas/catalog";

const listPricingRulesRoute = createRoute({
  method: "get",
  path: "/catalog/{id}/pricing-rules",
  operationId: "listPricingRules",
  tags: ["pricing"],
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Pricing rules for listing",
      content: { "application/json": { schema: pricingRulesListSchema } },
    },
    404: { description: "Listing not found" },
  },
});

const addPricingRuleRoute = createRoute({
  method: "post",
  path: "/catalog/{id}/pricing-rules",
  operationId: "addPricingRule",
  tags: ["pricing"],
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: pricingRuleInputSchema } },
    },
  },
  responses: {
    201: {
      description: "Pricing rule added",
      content: { "application/json": { schema: pricingRuleSchema } },
    },
    400: { description: "Validation error or too many rules (max 5)" },
    401: { description: "Authentication required" },
    404: { description: "Listing not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const replacePricingRulesRoute = createRoute({
  method: "put",
  path: "/catalog/{id}/pricing-rules",
  operationId: "replacePricingRules",
  tags: ["pricing"],
  request: {
    params: idParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: replacePricingRulesBodySchema } },
    },
  },
  responses: {
    200: {
      description: "All pricing rules replaced atomically",
      content: { "application/json": { schema: pricingRulesListSchema } },
    },
    400: { description: "Validation error" },
    401: { description: "Authentication required" },
    404: { description: "Listing not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const deletePricingRuleRoute = createRoute({
  method: "delete",
  path: "/catalog/{id}/pricing-rules/{ruleId}",
  operationId: "deletePricingRule",
  tags: ["pricing"],
  request: { params: ruleIdParamSchema },
  responses: {
    200: {
      description: "Pricing rule deleted",
      content: { "application/json": { schema: pricingRuleSchema } },
    },
    401: { description: "Authentication required" },
    404: { description: "Listing or rule not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const priceQueryRoute = createRoute({
  method: "get",
  path: "/catalog/price-query",
  operationId: "queryPrice",
  tags: ["pricing"],
  request: { query: priceQueryParamsSchema },
  responses: {
    200: {
      description:
        "AI-optimised price query. Returns empty matches array (never 404) when no results found. Use matches[].price for the resolved price; canFulfil:true means the shop has capacity right now.",
      content: { "application/json": { schema: priceQueryResponseSchema } },
    },
  },
});

const syncFeedRoute = createRoute({
  method: "get",
  path: "/catalog/sync-feed",
  operationId: "getCatalogSyncFeed",
  tags: ["catalog"],
  request: { query: syncFeedQuerySchema },
  responses: {
    200: {
      description: "Listings changed since given timestamp, for ERP/external system polling",
      content: { "application/json": { schema: syncFeedResponseSchema } },
    },
    400: { description: "Invalid since timestamp" },
    401: { description: "catalog:read API key required" },
  },
  security: [{ apiKey: [] }],
});

export function registerPricingRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(listPricingRulesRoute, async (c) => {
    const { id } = c.req.valid("param");
    const listing = await prisma.productListing.findUnique({ where: { id }, select: { id: true } });
    if (!listing)
      return c.json({ error: { code: "NOT_FOUND", message: "Listing not found" } } as never, 404);
    const rules = await prisma.pricingRule.findMany({
      where: { listingId: id },
      orderBy: { createdAt: "asc" },
    });
    return c.json(
      rules.map((r) => ({
        ...r,
        decaySchedule: r.decaySchedule ?? undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })) as never,
    );
  });

  app.openapi(addPricingRuleRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { id } = c.req.valid("param");
    const input = c.req.valid("json") as {
      type: string;
      decaySchedule?: {
        startDate: string;
        endDate: string;
        startPrice: number;
        endPrice: number;
        curve?: string;
      };
    };

    const listing = await prisma.productListing.findUnique({ where: { id }, select: { id: true } });
    if (!listing)
      return c.json({ error: { code: "NOT_FOUND", message: "Listing not found" } } as never, 404);

    const existing = await prisma.pricingRule.count({ where: { listingId: id } });
    if (existing >= 5)
      return jsonError(c, "TOO_MANY_RULES", 400, "A listing can have at most 5 pricing rules") as never;

    if (input.type === "DECAY" && !input.decaySchedule) {
      return jsonError(c, "DECAY_REQUIRES_SCHEDULE", 400, "Decay rule requires a decaySchedule") as never;
    }
    if (input.decaySchedule) {
      const s = new Date(input.decaySchedule.startDate),
        e = new Date(input.decaySchedule.endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
        return jsonError(c, "INVALID_DATE_RANGE", 400, "endDate must be after startDate") as never;
      }
    }

    const rule = await prisma.pricingRule.create({
      data: {
        listingId: id,
        type: input.type as never,
        decaySchedule: (input.decaySchedule as never) ?? null,
      },
    } as never);
    const r = rule as {
      id: string;
      listingId: string;
      type: string;
      decaySchedule: unknown;
      createdAt: Date;
      updatedAt: Date;
    };
    return c.json(
      {
        id: r.id,
        listingId: r.listingId,
        type: r.type,
        decaySchedule: r.decaySchedule ?? undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      } as never,
      201,
    );
  });

  app.openapi(replacePricingRulesRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { id } = c.req.valid("param");
    const { rules } = c.req.valid("json") as {
      rules: Array<{
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

    const listing = await prisma.productListing.findUnique({ where: { id }, select: { id: true } });
    if (!listing)
      return c.json({ error: { code: "NOT_FOUND", message: "Listing not found" } } as never, 404);

    for (const rule of rules) {
      if (rule.type === "DECAY" && !rule.decaySchedule) {
        return jsonError(c, "DECAY_REQUIRES_SCHEDULE", 400, "Decay rule requires a decaySchedule") as never;
      }
      if (rule.decaySchedule) {
        const s = new Date(rule.decaySchedule.startDate),
          e = new Date(rule.decaySchedule.endDate);
        if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
          return jsonError(c, "INVALID_DATE_RANGE", 400, "endDate must be after startDate") as never;
        }
      }
    }

    const newRules = await prisma.$transaction([
      prisma.pricingRule.deleteMany({ where: { listingId: id } }),
      ...rules.map((r) =>
        prisma.pricingRule.create({
          data: { listingId: id, type: r.type as never, decaySchedule: (r.decaySchedule as never) ?? null },
        } as never),
      ),
    ]);

    const created = newRules.slice(1) as Array<{
      id: string;
      listingId: string;
      type: string;
      decaySchedule: unknown;
      createdAt: Date;
      updatedAt: Date;
    }>;
    return c.json(
      created.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        type: r.type,
        decaySchedule: r.decaySchedule ?? undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })) as never,
    );
  });

  app.openapi(deletePricingRuleRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { id, ruleId } = c.req.valid("param");
    const rule = await prisma.pricingRule.findFirst({ where: { id: ruleId, listingId: id } });
    if (!rule)
      return c.json({ error: { code: "NOT_FOUND", message: "Pricing rule not found" } } as never, 404);

    const deleted = await prisma.pricingRule.delete({ where: { id: ruleId } });
    const d = deleted as {
      id: string;
      listingId: string;
      type: string;
      decaySchedule: unknown;
      createdAt: Date;
      updatedAt: Date;
    };
    return c.json({
      id: d.id,
      listingId: d.listingId,
      type: d.type,
      decaySchedule: d.decaySchedule ?? undefined,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    } as never);
  });

  app.openapi(priceQueryRoute, async (c) => {
    const { resolvePrice: resolvePriceCore } = await import("@tpt/core/pricing");
    const query = c.req.valid("query");

    if (featureFlags.ENABLE_PRICE_QUERY_AUTH) {
      const token = getAuthToken(c);
      if (!token)
        return jsonError(c, "UNAUTHORIZED", 401, "catalog:read API key required") as never;
      const apiKeyRecord = await resolveApiKey(token);
      if (!apiKeyRecord || !apiKeyHasScope(apiKeyRecord, "catalog:read")) {
        return jsonError(c, "UNAUTHORIZED", 401, "catalog:read scope required") as never;
      }
    }

    const capabilityWhere: Record<string, unknown> = {
      category: { contains: query.category },
      material: { contains: query.material },
      machineType: { contains: query.machineType },
      shop: { active: true },
    };
    if (query.shopId) capabilityWhere.shopId = query.shopId;

    const matchingCapabilities = await prisma.shopCapability.findMany({
      where: capabilityWhere as never,
      include: { shop: true },
    } as never);

    const shopIds = [
      ...new Set((matchingCapabilities as Array<{ shopId: string }>).map((c) => c.shopId)),
    ];

    const listingWhere: Record<string, unknown> = {
      active: true,
      category: { contains: query.category },
      OR: [{ shopId: { in: shopIds } }, { shopId: null }],
    };

    const listings = await prisma.productListing.findMany({
      where: listingWhere as never,
      include: {
        pricingRules: true,
        shop: {
          select: { name: true, locationLat: true, locationLng: true, active: true, capacity: true },
        },
      },
      orderBy: { price: "asc" },
      take: 50,
    } as never);

    const now = new Date();
    const matches: Array<{
      listingId: string;
      title: string;
      shopId: string | null;
      shopName: string | null;
      shopLocation: { lat: number; lng: number } | null;
      price: number;
      currency: string;
      priceBreakdown: {
        basePrice: number;
        ruleType: string | null;
        decayProgress: number | null;
        decayCurve: string | null;
      };
      canFulfil: boolean;
    }> = [];

    for (const listing of listings as unknown as Array<{
      id: string;
      title: string;
      shopId: string | null;
      price: number;
      currency: string;
      active: boolean;
      pricingRules: Array<{ type: string; decaySchedule: unknown }>;
      shop: {
        name: string;
        locationLat: number;
        locationLng: number;
        active: boolean;
        capacity: number;
      } | null;
    }>) {
      const breakdown = resolvePriceCore(
        listing as unknown as ProductListing,
        featureFlags,
        { now },
      );

      const shop = listing.shop;
      const canFulfil = !!shop?.active && (shop?.capacity ?? 0) > 0;

      matches.push({
        listingId: listing.id,
        title: listing.title,
        shopId: listing.shopId ?? null,
        shopName: shop?.name ?? null,
        shopLocation: shop ? { lat: shop.locationLat, lng: shop.locationLng } : null,
        price: breakdown.price,
        currency: listing.currency,
        priceBreakdown: {
          basePrice: listing.price,
          ruleType: breakdown.ruleType ?? null,
          decayProgress: breakdown.decay?.progress ?? null,
          decayCurve: breakdown.decay?.curve ?? null,
        },
        canFulfil,
      });
    }

    return c.json({
      query: {
        material: query.material,
        machineType: query.machineType,
        category: query.category,
        quantity: query.quantity,
      },
      matches,
      totalMatches: matches.length,
      resolvedAt: now.toISOString(),
    } as never);
  });

  app.openapi(syncFeedRoute, async (c) => {
    const token = getAuthToken(c);
    if (!token)
      return jsonError(c, "UNAUTHORIZED", 401, "catalog:read API key required") as never;
    const apiKeyRecord = await resolveApiKey(token);
    if (!apiKeyRecord || !apiKeyHasScope(apiKeyRecord, "catalog:read")) {
      return jsonError(c, "UNAUTHORIZED", 401, "catalog:read scope required") as never;
    }

    const query = c.req.valid("query");
    const since = new Date(query.since);

    const listingWhere: Record<string, unknown> = { updatedAt: { gte: since }, active: true };
    if (query.shopId) listingWhere.shopId = query.shopId;

    const deletedWhere: Record<string, unknown> = { updatedAt: { gte: since }, active: false };
    if (query.shopId) deletedWhere.shopId = query.shopId;

    const [listings, deleted] = await prisma.$transaction([
      prisma.productListing.findMany({
        where: listingWhere as never,
        include: {
          designFiles: { orderBy: { createdAt: "desc" } },
          pricingRules: true,
        },
        orderBy: { updatedAt: "asc" },
      } as never),
      prisma.productListing.findMany({
        where: deletedWhere as never,
        select: { id: true },
      } as never),
    ]);

    const nextSince = new Date().toISOString();
    return c.json({
      listings: (listings as unknown as Parameters<typeof listingToResponse>[0][]).map(
        listingToResponse,
      ),
      deletedIds: (deleted as Array<{ id: string }>).map((d) => d.id),
      nextSince,
    } as never);
  });
}
