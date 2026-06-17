import { z } from "@hono/zod-openapi";
import { paginationMetaSchema } from "./common";

export const orderStatusValues = [
  "PENDING",
  "ROUTED",
  "IN_PRODUCTION",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
] as const;
export const orderStatusSchema = z.enum(orderStatusValues);

export const orderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  listingId: z.string().optional(),
  designFileId: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const orderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: orderStatusSchema,
  items: z.array(orderItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const orderListSchema = z.object({
  data: z.array(orderSchema),
  meta: paginationMetaSchema,
});

export const placeOrderSchema = z.object({
  userId: z.string().min(1),
  items: z
    .array(
      z.object({
        listingId: z.string().min(1).optional(),
        designFileId: z.string().min(1).optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
      }),
    )
    .min(1),
  useCredits: z.boolean().default(false),
});

export const customOrderRequestSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  request: z.string(),
  status: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createCustomOrderRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  request: z.string().trim().min(20).max(5000),
  metadata: z.record(z.unknown()).optional(),
});
