import type { OpenAPIHono } from "@hono/zod-openapi";
import { createConnection } from "node:net";
import { prisma } from "../lib/prisma";
import { log } from "../lib/logger";
import { redisConnection } from "../lib/env";
import type { AppBindings } from "../types/hono";

export function registerHealthRoutes(app: OpenAPIHono<AppBindings>) {
  app.get("/health", async (c) => {
    const checks: Record<string, boolean> = { db: false, redis: false };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch (err) {
      log.error({ err }, "health: DB ping failed");
    }

    await new Promise<void>((resolve) => {
      const socket = createConnection({
        host: redisConnection.host,
        port: redisConnection.port,
      });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve();
      }, 2000);
      socket.on("connect", () => {
        clearTimeout(timer);
        checks.redis = true;
        socket.destroy();
        resolve();
      });
      socket.on("error", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    const ok = checks.db && checks.redis;
    return c.json({ ok, checks }, ok ? 200 : 503);
  });
}
