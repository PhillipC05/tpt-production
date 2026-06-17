import { z } from "@hono/zod-openapi";
import { paginationMetaSchema } from "./common";
import { orderStatusSchema } from "./orders";

export const fulfillmentJobStatusValues = [
  "PENDING",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export const fulfillmentJobStatusSchema = z.enum(fulfillmentJobStatusValues);

export const fulfillmentJobSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  shopId: z.string().optional(),
  supplierId: z.string().optional(),
  status: fulfillmentJobStatusSchema,
  acceptedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const fulfillmentJobListSchema = z.object({
  data: z.array(fulfillmentJobSchema),
  meta: paginationMetaSchema,
});

export const routingDecisionSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  shopId: z.string().optional(),
  geoScore: z.number(),
  costScore: z.number(),
  capacityScore: z.number(),
  capabilityScore: z.number(),
  totalScore: z.number(),
  chosen: z.boolean(),
  createdAt: z.string().datetime(),
});

export const routingDecisionListSchema = z.object({
  data: z.array(routingDecisionSchema),
  meta: paginationMetaSchema,
});

export { orderStatusSchema };
