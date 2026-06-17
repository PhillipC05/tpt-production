import { z } from "@hono/zod-openapi";
import { pricingRuleTypeSchema } from "./common";

export const designFileSchema = z.object({
  id: z.string(),
  listingId: z.string().optional(),
  uploaderId: z.string(),
  fileKey: z.string(),
  fileType: z.string(),
  drmEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const pricingRuleSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  type: pricingRuleTypeSchema,
  decaySchedule: z.unknown().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const pricingRulesListSchema = z.array(pricingRuleSchema);

export const decayScheduleInputSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  startPrice: z.number().finite().nonnegative(),
  endPrice: z.number().finite().nonnegative(),
  curve: z.enum(["linear", "exponential", "step"]).default("linear"),
  steps: z
    .array(z.object({ at: z.number().min(0).max(1), price: z.number().nonnegative() }))
    .optional(),
});

export const pricingRuleInputSchema = z.object({
  type: pricingRuleTypeSchema,
  decaySchedule: decayScheduleInputSchema.optional(),
});

export const replacePricingRulesBodySchema = z.object({
  rules: z.array(pricingRuleInputSchema).min(0).max(5),
});

export const ruleIdParamSchema = z.object({
  id: z.string().min(1).openapi({ param: { name: "id", in: "path" }, example: "cm..." }),
  ruleId: z.string().min(1).openapi({ param: { name: "ruleId", in: "path" }, example: "cm..." }),
});

export const priceQueryParamsSchema = z.object({
  material: z.string().trim().min(1).max(80),
  machineType: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().min(1).default(1),
  shopId: z.string().optional(),
});

export const priceMatchSchema = z.object({
  listingId: z.string(),
  title: z.string(),
  shopId: z.string().nullable().optional(),
  shopName: z.string().nullable().optional(),
  shopLocation: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  price: z.number(),
  currency: z.string(),
  priceBreakdown: z.object({
    basePrice: z.number(),
    ruleType: z.string().nullable().optional(),
    decayProgress: z.number().nullable().optional(),
    decayCurve: z.string().nullable().optional(),
  }),
  canFulfil: z.boolean(),
});

export const priceQueryResponseSchema = z.object({
  query: z.object({
    material: z.string(),
    machineType: z.string(),
    category: z.string(),
    quantity: z.number().int(),
  }),
  matches: z.array(priceMatchSchema).openapi({
    description:
      "Use matches[].price for the current resolved price. canFulfil: true means shop has capacity now.",
  }),
  totalMatches: z.number().int(),
  resolvedAt: z.string().datetime(),
});

export const syncFeedQuerySchema = z.object({
  since: z.string().datetime(),
  shopId: z.string().optional(),
});

// syncFeedResponseSchema is defined in bulk.ts (after productListingSchema is available)
