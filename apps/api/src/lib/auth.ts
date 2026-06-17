import { createHash } from "node:crypto";
import type { ApiContext } from "./errors";
import { jsonError, safeEqual } from "./errors";
import { prisma } from "./prisma";

export function getAuthToken(c: ApiContext) {
  const authorization = c.req.header("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  return c.req.header("x-api-key");
}

export async function requireAuth(c: ApiContext): Promise<Response | null> {
  const token = getAuthToken(c);
  if (!token) return jsonError(c, "UNAUTHORIZED", 401 as never);

  const apiKey = await resolveApiKey(token);
  if (!apiKey) return jsonError(c, "UNAUTHORIZED", 401 as never);

  c.set("user", { id: apiKey.user.id, role: "USER" });
  return null;
}

export function requireAdmin(c: ApiContext): Response | null {
  const token = getAuthToken(c);
  const configuredToken = process.env.ADMIN_API_TOKEN;

  if (!configuredToken) {
    if (process.env.NODE_ENV === "production") {
      return jsonError(c, "ADMIN_TOKEN_NOT_CONFIGURED", 401 as never);
    }
    return null;
  }

  if (!token || !safeEqual(token, configuredToken)) {
    return jsonError(c, "ADMIN_UNAUTHORIZED", 401 as never);
  }

  return null;
}

export function requireDesignAccess(c: ApiContext): Response | null {
  const token = getAuthToken(c);
  const configuredToken = process.env.ADMIN_API_TOKEN;

  if (!configuredToken) {
    if (process.env.NODE_ENV === "production") {
      return jsonError(c, "DRM_ACCESS_TOKEN_NOT_CONFIGURED", 403 as never);
    }
    return null;
  }

  if (!token || !safeEqual(token, configuredToken)) {
    return jsonError(c, "DRM_UNAUTHORIZED", 403 as never);
  }

  return null;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export async function resolveApiKey(xApiKey: string) {
  const hash = hashApiKey(xApiKey);
  const record = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    include: { user: true },
  });
  if (!record) return null;
  await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  return record;
}

export function apiKeyHasScope(apiKey: { scopes: string }, scope: string): boolean {
  if (!apiKey.scopes) return true;
  return apiKey.scopes.split(",").some((s) => s.trim() === scope);
}