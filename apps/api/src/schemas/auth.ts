import { z } from "@hono/zod-openapi";

export const apiKeyResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  scopes: z.string(),
  lastUsedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createApiKeySchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});
