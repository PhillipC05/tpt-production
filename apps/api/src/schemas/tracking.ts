import { z } from "@hono/zod-openapi";

export const trackingEventResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  source: z.string(),
  status: z.string(),
  note: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  createdAt: z.string().datetime(),
});

export const pushTrackingSchema = z.object({
  source: z.string().trim().min(1).max(80),
  status: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
});

export const webhookTrackingSchema = z.object({
  orderId: z.string().min(1),
  source: z.string().trim().min(1).max(80),
  status: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
});

export const orderIdParamSchema = z.object({
  orderId: z.string().min(1).openapi({
    param: { name: "orderId", in: "path" },
    example: "cm2...",
  }),
});
