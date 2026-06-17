import { OpenAPIHono } from "@hono/zod-openapi";
import { SwaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import { randomUUID } from "node:crypto";
import { allowedOrigins } from "./lib/env";
import { log } from "./lib/logger";
import { isPrismaKnownRequestError, prismaStatus } from "./lib/errors";
import type { AppBindings } from "./types/hono";
import { registerHealthRoutes } from "./routes/health";
import { registerCatalogRoutes } from "./routes/catalog";
import { registerCatalogBulkRoutes } from "./routes/catalog-bulk";
import { registerPricingRoutes } from "./routes/pricing";
import { registerShopsRoutes } from "./routes/shops";
import { registerDesignsRoutes } from "./routes/designs";
import { registerOrdersRoutes } from "./routes/orders";
import { registerFulfillmentRoutes } from "./routes/fulfillment";
import { registerTrackingRoutes } from "./routes/tracking";
import { registerCreditsRoutes } from "./routes/credits";
import { registerPaymentsRoutes } from "./routes/payments";
import { registerAuthRoutes } from "./routes/auth";
import { registerAdminRoutes } from "./routes/admin";
import { featureFlags } from "@tpt/core/flags";

export function createApp(): OpenAPIHono<AppBindings> {
  const app = new OpenAPIHono<AppBindings>();

  // ── Security: rate limiting ─────────────────────────────────────────────────
  app.use(
    "*",
    rateLimiter({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-6",
      keyGenerator: (c) => {
        const xff = (c.req.header("x-forwarded-for")?.split(",")[0] ?? "").trim();
        return xff || c.req.header("x-real-ip") || "unknown";
      },
    }),
  );

  // ── Security: CORS ──────────────────────────────────────────────────────────
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (allowedOrigins.length === 0) return origin;
        return allowedOrigins.includes(origin) ? origin : null;
      },
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
      exposeHeaders: ["X-Request-ID"],
      maxAge: 600,
    }),
  );

  // ── Security: Helmet-equivalent headers ────────────────────────────────────
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("X-XSS-Protection", "0");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  });

  // ── Observability: request ID + structured request logging ─────────────────
  app.use("*", async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    const start = Date.now();
    await next();
    log.info({
      requestId,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      ms: Date.now() - start,
    });
  });

  // ── Root info ───────────────────────────────────────────────────────────────
  app.get("/", (c) =>
    c.json({ name: "TPT Marketplace API", openapi: "/openapi.json", docs: "/docs" }),
  );

  // ── Feature flags ───────────────────────────────────────────────────────────
  app.get("/flags", (c) => c.json(featureFlags));

  // ── Register route modules ──────────────────────────────────────────────────
  registerHealthRoutes(app);
  registerCatalogRoutes(app);
  registerCatalogBulkRoutes(app);
  registerPricingRoutes(app);
  registerShopsRoutes(app);
  registerDesignsRoutes(app);
  registerOrdersRoutes(app);
  registerFulfillmentRoutes(app);
  registerTrackingRoutes(app);
  registerCreditsRoutes(app);
  registerPaymentsRoutes(app);
  registerAuthRoutes(app);
  registerAdminRoutes(app);

  // ── OpenAPI docs ────────────────────────────────────────────────────────────
  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "TPT Marketplace API",
      version: "1.0.0",
      description: [
        "## TPT Marketplace API",
        "",
        "REST API for the TPT automated production platform. All endpoints follow REST conventions.",
        "",
        "### AI Agent Quick Reference",
        "",
        "| Task | Endpoint |",
        "|------|----------|",
        "| Find pricing for a product spec | `GET /catalog/price-query?material=PLA&machineType=FDM&category=Figurines` |",
        "| Load a maker's full price sheet | `PUT /shops/{id}/price-sheet` |",
        "| Bulk create/update listings | `POST /catalog/bulk` |",
        "| Import listings from CSV | `POST /catalog/import/csv` |",
        "| Poll for changed listings | `GET /catalog/sync-feed?since=<ISO timestamp>` |",
        "| Manage pricing rules | `GET/POST/PUT/DELETE /catalog/{id}/pricing-rules` |",
        "",
        "### Rate Limits",
        "",
        "120 requests/minute per IP. Bulk endpoints count as a single request.",
        "",
        "### Auth",
        "",
        "Admin endpoints: `Authorization: Bearer <ADMIN_API_TOKEN>` or `X-API-Key: <token>`.",
        "Maker endpoints: `X-API-Key: <catalog:write scoped key>`.",
        "Price query: public by default (no auth required unless `ENABLE_PRICE_QUERY_AUTH=true`).",
      ].join("\n"),
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "opaque" },
        apiKey: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
    },
  } as never);

  app.get("/docs", (c) =>
    c.html(SwaggerUI({ url: "/openapi.json", title: "TPT Marketplace API" })),
  );

  // ── 404 handler ─────────────────────────────────────────────────────────────
  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: `Route ${c.req.method} ${c.req.path} was not found`,
          details: { requestId: c.get("requestId") },
        },
      },
      404,
    ),
  );

  // ── Error handler ───────────────────────────────────────────────────────────
  app.onError((err, c) => {
    const details = { requestId: c.get("requestId") };

    if (isPrismaKnownRequestError(err)) {
      const status = prismaStatus(err.code);
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            details: { ...details, meta: err.meta },
          },
        },
        status as never,
      );
    }

    return c.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
          details,
        },
      },
      500,
    );
  });

  return app;
}
