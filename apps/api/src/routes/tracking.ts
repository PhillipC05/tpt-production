import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { mapTrackingEvent } from "../lib/mappers";
import { verifyWebhookSignature } from "../lib/webhooks";
import { emitToOrder } from "../lib/sockets";
import type { AppBindings } from "../types/hono";
import { idParamSchema } from "../schemas/common";
import {
  trackingEventResponseSchema,
  pushTrackingSchema,
  webhookTrackingSchema,
  orderIdParamSchema,
} from "../schemas/tracking";
import { z } from "@hono/zod-openapi";

const pushTrackingRoute = createRoute({
  method: "post",
  path: "/tracking/{orderId}",
  request: {
    params: orderIdParamSchema,
    body: {
      required: true,
      content: { "application/json": { schema: pushTrackingSchema } },
    },
  },
  responses: {
    201: {
      description: "Tracking event created",
      content: { "application/json": { schema: trackingEventResponseSchema } },
    },
    401: { description: "Unauthorized" },
    404: { description: "Order not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const getTrackingRoute = createRoute({
  method: "get",
  path: "/orders/{id}/tracking",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Tracking history",
      content: { "application/json": { schema: z.array(trackingEventResponseSchema) } },
    },
    404: { description: "Order not found" },
  },
});

export function registerTrackingRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(pushTrackingRoute, async (c) => {
    const authError = requireAdmin(c);
    if (authError) return authError as never;

    const { orderId } = c.req.valid("param");
    const body = c.req.valid("json");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order)
      return c.json({ code: "NOT_FOUND", message: "Order not found" }, 404) as never;

    const event = await prisma.trackingEvent.create({
      data: {
        orderId,
        source: body.source,
        status: body.status,
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.lat !== undefined ? { lat: body.lat } : {}),
        ...(body.lng !== undefined ? { lng: body.lng } : {}),
      },
    });

    const mapped = mapTrackingEvent(event);
    emitToOrder(orderId, "tracking", mapped);
    return c.json(mapped as never, 201);
  });

  app.openapi(getTrackingRoute, async (c) => {
    const { id } = c.req.valid("param");
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order)
      return c.json({ code: "NOT_FOUND", message: "Order not found" }, 404) as never;

    const events = await prisma.trackingEvent.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "desc" },
    });

    return c.json(events.map(mapTrackingEvent) as never);
  });

  // Non-OpenAPI raw webhook endpoint (needs raw body for signature verification)
  app.post("/webhooks/tracking", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-hub-signature-256") ?? "";
    const secret = process.env.WEBHOOK_SECRET;

    if (secret) {
      if (!verifyWebhookSignature(rawBody, signature, secret)) {
        return c.json(
          { error: { code: "INVALID_SIGNATURE", message: "Invalid webhook signature" } },
          401,
        );
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return c.json({ error: { code: "INVALID_JSON", message: "Invalid JSON body" } }, 400);
    }

    const result = webhookTrackingSchema.safeParse(parsed);
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid payload",
            details: result.error.flatten(),
          },
        },
        400,
      );
    }

    const { orderId, source, status, note, lat, lng } = result.data;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order)
      return c.json({ error: { code: "NOT_FOUND", message: "Order not found" } }, 404);

    const event = await prisma.trackingEvent.create({
      data: {
        orderId,
        source,
        status,
        ...(note !== undefined ? { note } : {}),
        ...(lat !== undefined ? { lat } : {}),
        ...(lng !== undefined ? { lng } : {}),
      },
    });

    const mapped = mapTrackingEvent(event);
    emitToOrder(orderId, "tracking", mapped);
    return c.json(mapped, 201);
  });
}
