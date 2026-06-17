import { z } from "@hono/zod-openapi";

export const scorerStatusSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().nullable(),
});

export const updateScorerBodySchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().url().nullable().optional(),
});

export const webhookResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  events: z.string(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createWebhookBodySchema = z.object({
  url: z.string().url().max(500),
  secret: z.string().min(16).max(256),
  events: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});
