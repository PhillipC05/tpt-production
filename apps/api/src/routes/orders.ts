import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { CreateCustomOrderRequestInput } from "@tpt/types";
import type { JsonValue } from "@tpt/types";
import { featureFlags } from "@tpt/core/flags";
import { prisma } from "../lib/prisma";
import { ensureCreditAccount } from "../lib/credits";
import { dispatchWebhooks } from "../lib/webhooks";
import { mapOrder, customOrderRequestToResponse } from "../lib/mappers";
import { routingQueue } from "../lib/queues";
import type { AppBindings } from "../types/hono";
import { idParamSchema } from "../schemas/common";
import {
  orderSchema,
  orderListSchema,
  placeOrderSchema,
  customOrderRequestSchema,
  createCustomOrderRequestSchema,
} from "../schemas/orders";

const placeOrderRoute = createRoute({
  method: "post",
  path: "/orders",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: placeOrderSchema } },
    },
  },
  responses: {
    201: {
      description: "Order created",
      content: { "application/json": { schema: orderSchema } },
    },
    400: { description: "Bad request" },
  },
});

const listOrdersRoute = createRoute({
  method: "get",
  path: "/orders",
  request: {
    query: z.object({
      userId: z.string().min(1).openapi({ param: { name: "userId", in: "query" } }),
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
      description: "Orders",
      content: { "application/json": { schema: orderListSchema } },
    },
  },
});

const getOrderRoute = createRoute({
  method: "get",
  path: "/orders/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Order",
      content: { "application/json": { schema: orderSchema } },
    },
    404: { description: "Not found" },
  },
});

const cancelOrderRoute = createRoute({
  method: "post",
  path: "/orders/{id}/cancel",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Cancelled",
      content: { "application/json": { schema: orderSchema } },
    },
    400: { description: "Cannot cancel" },
    404: { description: "Not found" },
  },
});

const createCustomOrderRoute = createRoute({
  method: "post",
  path: "/orders/custom",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createCustomOrderRequestSchema } },
    },
  },
  responses: {
    202: {
      description: "Custom order request submitted",
      content: { "application/json": { schema: customOrderRequestSchema } },
    },
  },
});

export function registerOrdersRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(placeOrderRoute, async (c) => {
    const body = c.req.valid("json");
    const order = await prisma.order.create({
      data: {
        userId: body.userId,
        items: {
          create: body.items.map((item) => ({
            ...(item.listingId ? { listingId: item.listingId } : {}),
            ...(item.designFileId ? { designFileId: item.designFileId } : {}),
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    const orderTotal = order.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    if (featureFlags.ENABLE_CREDITS && body.useCredits && orderTotal > 0) {
      const account = await ensureCreditAccount(body.userId);
      if (account.balance >= orderTotal) {
        await prisma.$transaction([
          prisma.creditAccount.update({
            where: { id: account.id },
            data: { balance: { decrement: orderTotal } },
          }),
          prisma.creditTransaction.create({
            data: {
              accountId: account.id,
              amount: -orderTotal,
              type: "SPENT",
              note: `Order ${order.id}`,
            },
          }),
        ]);
      }
    }

    if (featureFlags.ENABLE_PAYMENTS && !featureFlags.ENABLE_FREE_ECONOMY) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: orderTotal,
          currency: "NZD",
          status: "PENDING",
        },
      });
    } else {
      await routingQueue.add("route-order", { orderId: order.id });
    }

    return c.json(mapOrder(order) as never, 201);
  });

  app.openapi(listOrdersRoute, async (c) => {
    const { userId, page, pageSize } = c.req.valid("query");
    const skip = (page - 1) * pageSize;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.order.count({ where: { userId } }),
    ]);
    return c.json(
      {
        data: orders.map(mapOrder),
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      } as never,
      200,
    );
  });

  app.openapi(getOrderRoute, async (c) => {
    const { id } = c.req.valid("param");
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return c.json({ code: "NOT_FOUND", message: "Order not found" }, 404) as never;
    return c.json(mapOrder(order), 200);
  });

  app.openapi(cancelOrderRoute, async (c) => {
    const { id } = c.req.valid("param");
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return c.json({ code: "NOT_FOUND", message: "Order not found" }, 404) as never;
    if (order.status !== "PENDING")
      return c.json(
        { code: "INVALID_STATE", message: "Only PENDING orders can be cancelled" },
        400,
      ) as never;
    const updated = await prisma.order.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: { items: true },
    });
    void dispatchWebhooks("order.status_changed", { orderId: id, status: "CANCELLED" });

    if (featureFlags.ENABLE_CREDITS) {
      const spentTx = await prisma.creditTransaction.findFirst({
        where: { note: `Order ${id}`, type: "SPENT" },
        include: { account: true },
      });
      if (spentTx) {
        const refundAmount = Math.abs(spentTx.amount);
        await prisma.$transaction([
          prisma.creditAccount.update({
            where: { id: spentTx.accountId },
            data: { balance: { increment: refundAmount } },
          }),
          prisma.creditTransaction.create({
            data: {
              accountId: spentTx.accountId,
              amount: refundAmount,
              type: "ADJUSTMENT",
              note: `Refund for cancelled order ${id}`,
            },
          }),
        ]);
      }
    }

    return c.json(mapOrder(updated), 200);
  });

  app.openapi(createCustomOrderRoute, async (c) => {
    const input = c.req.valid("json") as CreateCustomOrderRequestInput;
    const createData: Record<string, unknown> = {
      request: input.request,
    };

    if (input.name !== undefined) createData.name = input.name;
    if (input.email !== undefined) createData.email = input.email;
    if (input.phone !== undefined) createData.phone = input.phone;
    if (input.metadata !== undefined) createData.metadata = input.metadata as JsonValue | undefined;

    const customOrderRequest = await prisma.customOrderRequest.create({
      data: createData as never,
    } as never);

    return c.json(customOrderRequestToResponse(customOrderRequest) as never, 202);
  });
}
