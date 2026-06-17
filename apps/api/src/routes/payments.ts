import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { stripe } from "../lib/stripe";
import { requireAdmin } from "../lib/auth";
import { mapPayment } from "../lib/mappers";
import { routingQueue } from "../lib/queues";
import type { AppBindings } from "../types/hono";
import {
  paymentRecordSchema,
  paymentListSchema,
  createCheckoutSessionBodySchema,
  checkoutSessionResponseSchema,
} from "../schemas/payments";
import { paginationMetaSchema } from "../schemas/common";

const createCheckoutSessionRoute = createRoute({
  method: "post",
  path: "/payments/checkout-session",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createCheckoutSessionBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Checkout session URL",
      content: { "application/json": { schema: checkoutSessionResponseSchema } },
    },
    400: { description: "Payments not configured or order not found" },
    404: { description: "Order not found" },
  },
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

export function registerPaymentsRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(createCheckoutSessionRoute, async (c) => {
    if (!stripe) {
      return c.json(
        { error: { code: "PAYMENTS_NOT_CONFIGURED", message: "Stripe is not configured" } } as never,
        400,
      );
    }

    const { orderId, successUrl, cancelUrl } = c.req.valid("json");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    if (!order)
      return c.json({ error: { code: "NOT_FOUND", message: "Order not found" } } as never, 404);

    const amount = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "nzd",
            product_data: { name: `TPT Order ${orderId}` },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { orderId },
    });

    if (order.payment) {
      await prisma.payment.update({
        where: { orderId },
        data: { stripeCheckoutSessionId: session.id, amount, status: "PENDING" },
      });
    } else {
      await prisma.payment.create({
        data: {
          orderId,
          stripeCheckoutSessionId: session.id,
          amount,
          currency: "NZD",
          status: "PENDING",
        },
      });
    }

    return c.json({ url: session.url ?? "", sessionId: session.id } as never);
  });

  // Non-OpenAPI Stripe webhook endpoint (needs raw body for signature verification)
  app.post("/webhooks/stripe", async (c) => {
    if (!stripe) return c.json({ error: { code: "PAYMENTS_NOT_CONFIGURED" } }, 400);

    const rawBody = await c.req.text();
    const sig = c.req.header("stripe-signature") ?? "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;
    try {
      event = webhookSecret
        ? stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
        : (JSON.parse(rawBody) as Stripe.Event);
    } catch {
      return c.json({ error: { code: "INVALID_SIGNATURE" } }, 400);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await prisma.payment.updateMany({
          where: { stripeCheckoutSessionId: session.id },
          data: {
            status: "SUCCEEDED",
            stripePaymentIntentId:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          },
        });
        await routingQueue.add("route-order", { orderId });
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const intentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (intentId) {
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: intentId },
          data: { status: "REFUNDED" },
        });
      }
    }

    return c.json({ received: true });
  });

  app.openapi(adminListPaymentsRoute, async (c) => {
    const adminError = requireAdmin(c);
    if (adminError) return adminError as never;

    const { status, page, pageSize } = c.req.valid("query");
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);
    return c.json({
      data: payments.map(mapPayment),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    } as never);
  });
}
