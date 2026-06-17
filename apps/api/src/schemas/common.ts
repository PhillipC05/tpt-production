import { z } from "@hono/zod-openapi";
import { SourceType } from "@tpt/types";

export const sourceTypeValues = Object.values(SourceType) as [SourceType, ...SourceType[]];
export const sourceTypeSchema = z.enum(sourceTypeValues);
export const pricingRuleTypeSchema = z.enum(["FIXED", "COST_PLUS", "FREE", "DECAY"]);

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export const idParamSchema = z.object({
  id: z.string().min(1).openapi({
    param: { name: "id", in: "path" },
    example: "cm2...",
  }),
});

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
