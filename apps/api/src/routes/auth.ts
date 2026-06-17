import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { requireAdmin, hashApiKey } from "../lib/auth";
import type { AppBindings } from "../types/hono";
import { idParamSchema } from "../schemas/common";
import { apiKeyResponseSchema, createApiKeySchema } from "../schemas/auth";

const createApiKeyRoute = createRoute({
  method: "post",
  path: "/auth/api-keys",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createApiKeySchema } },
    },
  },
  responses: {
    201: {
      description: "API key created — rawKey shown once",
      content: {
        "application/json": { schema: apiKeyResponseSchema.extend({ rawKey: z.string() }) },
      },
    },
    401: { description: "Admin required" },
    404: { description: "User not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const deleteApiKeyRoute = createRoute({
  method: "delete",
  path: "/auth/api-keys/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Revoked",
      content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
    },
    401: { description: "Admin required" },
    404: { description: "Key not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

export function registerAuthRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(createApiKeyRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { userId, name, scopes } = c.req.valid("json");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return c.json({ error: { code: "NOT_FOUND", message: "User not found" } } as never, 404);
    }

    const rawKey = `tpt_${randomUUID().replace(/-/g, "")}`;
    const apiKey = await prisma.apiKey.create({
      data: { userId, name, keyHash: hashApiKey(rawKey), scopes: scopes.join(",") },
    });

    return c.json(
      {
        id: apiKey.id,
        userId: apiKey.userId,
        name: apiKey.name,
        scopes: apiKey.scopes,
        rawKey,
        createdAt: apiKey.createdAt.toISOString(),
        updatedAt: apiKey.updatedAt.toISOString(),
      } as never,
      201,
    );
  });

  app.openapi(deleteApiKeyRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { id } = c.req.valid("param");
    const existing = await prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "API key not found" } } as never, 404);
    }

    await prisma.apiKey.delete({ where: { id } });
    return c.json({ ok: true } as never);
  });
}
