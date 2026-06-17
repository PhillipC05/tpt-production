import { z } from "@hono/zod-openapi";
import { paginationMetaSchema } from "./common";

export const paymentRecordSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  stripeCheckoutSessionId: z.string().optional(),
  stripePaymentIntentId: z.string().optional(),
  status: z.enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]),
  amount: z.number(),
  currency: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const paymentListSchema = z.object({
  data: z.array(paymentRecordSchema),
  meta: paginationMetaSchema,
});

export const createCheckoutSessionBodySchema = z.object({
  orderId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const checkoutSessionResponseSchema = z.object({
  url: z.string(),
  sessionId: z.string(),
});
