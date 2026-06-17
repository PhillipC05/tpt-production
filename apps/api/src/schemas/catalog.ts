import { z } from "@hono/zod-openapi";
import { sourceTypeSchema, paginationMetaSchema } from "./common";
import { designFileSchema, pricingRuleSchema } from "./pricing";

export { designFileSchema, pricingRuleSchema };

export const productListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string().optional(),
  sourceType: sourceTypeSchema,
  price: z.number(),
  currency: z.string(),
  active: z.boolean(),
  designFiles: z.array(designFileSchema).optional(),
  pricingRules: z.array(pricingRuleSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const catalogListSchema = z.object({
  data: z.array(productListingSchema),
  meta: paginationMetaSchema,
});

export const createProductListingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(80).optional(),
  sourceType: sourceTypeSchema,
  price: z.number().finite().nonnegative(),
  currency: z.string().trim().min(3).max(3).default("NZD"),
  active: z.boolean().default(true),
  designFileIds: z.array(z.string().min(1)).max(20).optional(),
});

export const updateProductListingSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  sourceType: sourceTypeSchema.optional(),
  price: z.number().finite().nonnegative().optional(),
  currency: z.string().trim().min(3).max(3).optional(),
  active: z.boolean().optional(),
  designFileIds: z.array(z.string().min(1)).max(20).optional(),
});

export const catalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sourceType: sourceTypeSchema.optional(),
  category: z.string().trim().min(1).optional(),
  priceMin: z.coerce.number().finite().nonnegative().optional(),
  priceMax: z.coerce.number().finite().nonnegative().optional(),
  search: z.string().trim().min(1).optional(),
});

export const syncFeedResponseSchema = z.object({
  listings: z.array(productListingSchema),
  deletedIds: z.array(z.string()),
  nextSince: z.string().datetime(),
});
