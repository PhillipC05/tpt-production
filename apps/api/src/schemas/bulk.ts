import { z } from "@hono/zod-openapi";
import { sourceTypeSchema } from "./common";
import { pricingRuleInputSchema } from "./pricing";

export const bulkListingItemSchema = z.object({
  externalId: z.string().trim().min(1).max(120).optional(),
  shopId: z.string().optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(80).optional(),
  sourceType: sourceTypeSchema,
  price: z.number().finite().nonnegative(),
  currency: z.string().trim().min(3).max(3).default("NZD"),
  active: z.boolean().default(true),
  pricingRules: z.array(pricingRuleInputSchema).max(5).optional(),
});

export const bulkItemResultSchema = z.object({
  index: z.number().int().nonnegative(),
  externalId: z.string().optional(),
  status: z.enum(["created", "updated", "failed"]),
  id: z.string().optional(),
  error: z
    .object({ code: z.string(), message: z.string(), field: z.string().optional() })
    .optional(),
});

export const bulkResponseSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  failed: z.number().int(),
  results: z.array(bulkItemResultSchema),
});

export const bulkCatalogBodySchema = z.object({
  items: z.array(bulkListingItemSchema).min(1).max(200),
});

export const importJobSchema = z.object({
  id: z.string(),
  shopId: z.string().nullable().optional(),
  status: z.string(),
  totalRows: z.number().int(),
  created: z.number().int(),
  updated: z.number().int(),
  failed: z.number().int(),
  errorLog: z.unknown().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const priceSheetCapabilitySchema = z.object({
  material: z.string().trim().min(1).max(80),
  machineType: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(80),
});

export const priceSheetListingSchema = bulkListingItemSchema.extend({
  externalId: z.string().trim().min(1).max(120),
});

export const priceSheetBodySchema = z.object({
  capabilities: z.array(priceSheetCapabilitySchema).max(200),
  listings: z.array(priceSheetListingSchema).max(200),
  removeUnlisted: z.boolean().default(false),
});

export const priceSheetResponseSchema = z.object({
  capabilities: z.object({ upserted: z.number().int() }),
  listings: bulkResponseSchema,
});
