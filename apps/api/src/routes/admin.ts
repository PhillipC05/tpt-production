import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { ensureCreditAccount } from "../lib/credits";
import { mapWebhook, mapRoutingDecision } from "../lib/mappers";
import { getScorerStatus, updateScorerStatus } from "../lib/ai-scorer";
import type { AppBindings } from "../types/hono";
import { idParamSchema, paginationMetaSchema } from "../schemas/common";
import {
  scorerStatusSchema,
  updateScorerBodySchema,
  webhookResponseSchema,
  createWebhookBodySchema,
} from "../schemas/admin";
import { orderListSchema, orderStatusSchema } from "../schemas/orders";
import { routingDecisionListSchema } from "../schemas/fulfillment";
import { paymentRecordSchema } from "../schemas/payments";

const adminListOrdersRoute = createRoute({
  method: "get",
  path: "/admin/orders",
  request: {
    query: z.object({
      status: orderStatusSchema
        .optional()
        .openapi({ param: { name: "status", in: "query" } }),
      page: z.coerce
        .number()
        .int()
        .min(1)
        .default(1)
        .openapi({ param: { name: "page", in: "query" } }),
      pageSize: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .openapi({ param: { name: "pageSize", in: "query" } }),
    }),
  },
  responses: {
    200: {
      description: "All orders",
      content: { "application/json": { schema: orderListSchema } },
    },
    403: { description: "Forbidden" },
  },
});

const adminRoutingDecisionsRoute = createRoute({
  method: "get",
  path: "/admin/routing-decisions",
  request: {
    query: z.object({
      orderId: z.string().min(1).openapi({ param: { name: "orderId", in: "query" } }),
    }),
  },
  responses: {
    200: {
      description: "Routing decisions",
      content: { "application/json": { schema: routingDecisionListSchema } },
    },
    403: { description: "Forbidden" },
  },
});

const getScorerRoute = createRoute({
  method: "get",
  path: "/admin/routing/scorer",
  responses: {
    200: {
      description: "Scorer status",
      content: { "application/json": { schema: scorerStatusSchema } },
    },
    401: { description: "Admin required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const updateScorerRoute = createRoute({
  method: "post",
  path: "/admin/routing/scorer",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: updateScorerBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Scorer updated",
      content: { "application/json": { schema: scorerStatusSchema } },
    },
    401: { description: "Admin required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const createWebhookRoute = createRoute({
  method: "post",
  path: "/admin/webhooks",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createWebhookBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Webhook registered",
      content: { "application/json": { schema: webhookResponseSchema } },
    },
    401: { description: "Admin required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const deleteWebhookRoute = createRoute({
  method: "delete",
  path: "/admin/webhooks/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Removed",
      content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
    },
    401: { description: "Admin required" },
    404: { description: "Not found" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const listWebhooksRoute = createRoute({
  method: "get",
  path: "/admin/webhooks",
  responses: {
    200: {
      description: "Registered webhooks",
      content: { "application/json": { schema: z.array(webhookResponseSchema) } },
    },
    401: { description: "Admin required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const royaltiesPayoutRoute = createRoute({
  method: "post",
  path: "/royalties/payout",
  responses: {
    200: {
      description: "Payout processed",
      content: {
        "application/json": {
          schema: z.object({ processed: z.number().int(), totalCredits: z.number() }),
        },
      },
    },
    401: { description: "Admin required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

const adminListPaymentsRoute = createRoute({
  method: "get",
  path: "/admin/payments",
  request: {
    query: z.object({
      status: z
        .enum(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"])
        .optional()
        .openapi({ param: { name: "status", in: "query" } }),
      page: z.coerce
        .number()
        .int()
        .min(1)
        .default(1)
        .openapi({ param: { name: "page", in: "query" } }),
      pageSize: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .openapi({ param: { name: "pageSize", in: "query" } }),
    }),
  },
  responses: {
    200: {
      description: "Payment records",
      content: {
        "application/json": {
          schema: z.object({ data: z.array(paymentRecordSchema), meta: paginationMetaSchema }),
        },
      },
    },
    401: { description: "Admin required" },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
});

export function registerAdminRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(adminListOrdersRoute, async (c) => {
    requireAdmin(c);
    const { status, page, pageSize } = c.req.valid("query");
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);
    // inline mapOrder to avoid circular — re-use from mappers
    const { mapOrder } = await import("../lib/mappers");
    return c.json(
      {
        data: orders.map(mapOrder),
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      },
      200,
    );
  });

  app.openapi(adminRoutingDecisionsRoute, async (c) => {
    requireAdmin(c);
    const { orderId } = c.req.valid("query");
    const decisions = await prisma.routingDecision.findMany({
      where: { orderId },
      orderBy: { totalScore: "desc" },
    });
    const data = decisions.map(mapRoutingDecision);
    return c.json(
      { data, meta: { page: 1, pageSize: data.length, total: data.length, totalPages: 1 } },
      200,
    );
  });

  app.openapi(getScorerRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;
    return c.json(getScorerStatus() as never);
  });

  app.openapi(updateScorerRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const body = c.req.valid("json");
    const scorerInput: { enabled: boolean; endpoint?: string | null } = { enabled: body.enabled };
    if (body.endpoint !== undefined) scorerInput.endpoint = body.endpoint;
    return c.json(updateScorerStatus(scorerInput) as never);
  });

  app.openapi(createWebhookRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { url, secret, events } = c.req.valid("json");
    const webhook = await prisma.webhook.create({
      data: { url, secret, events: events.join(",") },
    });
    return c.json(mapWebhook(webhook) as never, 201);
  });

  app.openapi(deleteWebhookRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { id } = c.req.valid("param");
    const existing = await prisma.webhook.findUnique({ where: { id } });
    if (!existing) {
      return c.json({ error: { code: "NOT_FOUND", message: "Webhook not found" } } as never, 404);
    }
    await prisma.webhook.delete({ where: { id } });
    return c.json({ ok: true } as never);
  });

  app.openapi(listWebhooksRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const webhooks = await prisma.webhook.findMany({ orderBy: { createdAt: "desc" } });
    return c.json(webhooks.map(mapWebhook) as never);
  });

  app.openapi(royaltiesPayoutRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const unpaid = await prisma.designRoyalty.findMany({
      where: { paidAt: null, credits: { gt: 0 } },
    });
    const now = new Date();
    let processed = 0;
    let totalCredits = 0;

    for (const royalty of unpaid) {
      const account = await ensureCreditAccount(royalty.recipientId);
      await prisma.$transaction([
        prisma.creditAccount.update({
          where: { id: account.id },
          data: { balance: { increment: royalty.credits } },
        }),
        prisma.creditTransaction.create({
          data: {
            accountId: account.id,
            amount: royalty.credits,
            type: "EARNED",
            note: `Royalty for design ${royalty.designFileId} on order ${royalty.orderId}`,
          },
        }),
        prisma.designRoyalty.update({
          where: { id: royalty.id },
          data: { paidAt: now },
        }),
      ]);
      processed++;
      totalCredits += royalty.credits;
    }

    return c.json({ processed, totalCredits } as never);
  });

  app.openapi(adminListPaymentsRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { status, page, pageSize } = c.req.valid("query");
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};
    const { mapPayment } = await import("../lib/mappers");
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      prisma.payment.count({ where }),
    ]);
    return c.json({
      data: payments.map(mapPayment),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    } as never);
  });
}
