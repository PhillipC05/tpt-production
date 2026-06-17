import { createRoute } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { featureFlags } from "@tpt/core/flags";
import { prisma } from "../lib/prisma";
import { mapJob } from "../lib/mappers";
import { routingQueue } from "../lib/queues";
import { emitToOrder } from "../lib/sockets";
import { dispatchWebhooks } from "../lib/webhooks";
import type { AppBindings } from "../types/hono";
import { idParamSchema } from "../schemas/common";
import {
  fulfillmentJobSchema,
  fulfillmentJobListSchema,
  fulfillmentJobStatusSchema,
} from "../schemas/fulfillment";
import { z } from "@hono/zod-openapi";

const listJobsRoute = createRoute({
  method: "get",
  path: "/fulfillment-jobs",
  request: {
    query: z.object({
      shopId: z.string().min(1).optional().openapi({ param: { name: "shopId", in: "query" } }),
      status: fulfillmentJobStatusSchema
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
      description: "Jobs",
      content: { "application/json": { schema: fulfillmentJobListSchema } },
    },
  },
});

const getJobRoute = createRoute({
  method: "get",
  path: "/fulfillment-jobs/{id}",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Job",
      content: { "application/json": { schema: fulfillmentJobSchema } },
    },
    404: { description: "Not found" },
  },
});

const acceptJobRoute = createRoute({
  method: "post",
  path: "/fulfillment-jobs/{id}/accept",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Accepted",
      content: { "application/json": { schema: fulfillmentJobSchema } },
    },
    400: { description: "Bad state" },
    404: { description: "Not found" },
  },
});

const completeJobRoute = createRoute({
  method: "post",
  path: "/fulfillment-jobs/{id}/complete",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Completed",
      content: { "application/json": { schema: fulfillmentJobSchema } },
    },
    400: { description: "Bad state" },
    404: { description: "Not found" },
  },
});

const rejectJobRoute = createRoute({
  method: "post",
  path: "/fulfillment-jobs/{id}/reject",
  request: { params: idParamSchema },
  responses: {
    200: {
      description: "Rejected",
      content: { "application/json": { schema: fulfillmentJobSchema } },
    },
    400: { description: "Bad state" },
    404: { description: "Not found" },
  },
});

export function registerFulfillmentRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(listJobsRoute, async (c) => {
    const { shopId, status, page, pageSize } = c.req.valid("query");
    const skip = (page - 1) * pageSize;
    const where = {
      ...(shopId ? { shopId } : {}),
      ...(status ? { status } : {}),
    };
    const [jobs, total] = await Promise.all([
      prisma.fulfillmentJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.fulfillmentJob.count({ where }),
    ]);
    return c.json(
      {
        data: jobs.map(mapJob),
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      } as never,
      200,
    );
  });

  app.openapi(getJobRoute, async (c) => {
    const { id } = c.req.valid("param");
    const job = await prisma.fulfillmentJob.findUnique({ where: { id } });
    if (!job) return c.json({ code: "NOT_FOUND", message: "Job not found" }, 404) as never;
    return c.json(mapJob(job), 200);
  });

  app.openapi(acceptJobRoute, async (c) => {
    const { id } = c.req.valid("param");
    const job = await prisma.fulfillmentJob.findUnique({ where: { id } });
    if (!job) return c.json({ code: "NOT_FOUND", message: "Job not found" }, 404) as never;
    if (job.status !== "PENDING")
      return c.json({ code: "INVALID_STATE", message: "Job is not PENDING" }, 400) as never;
    const updated = await prisma.$transaction(async (tx) => {
      const j = await tx.fulfillmentJob.update({
        where: { id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      await tx.order.update({ where: { id: j.orderId }, data: { status: "IN_PRODUCTION" } });
      return j;
    });
    return c.json(mapJob(updated), 200);
  });

  app.openapi(completeJobRoute, async (c) => {
    const { id } = c.req.valid("param");
    const job = await prisma.fulfillmentJob.findUnique({ where: { id }, include: { order: true } });
    if (!job) return c.json({ code: "NOT_FOUND", message: "Job not found" }, 404) as never;
    if (job.status !== "ACCEPTED" && job.status !== "IN_PROGRESS") {
      return c.json(
        { code: "INVALID_STATE", message: "Job must be ACCEPTED or IN_PROGRESS" },
        400,
      ) as never;
    }
    const deliveryAssignment = await prisma.deliveryAssignment.findUnique({
      where: { orderId: job.orderId },
    });
    const nextOrderStatus =
      deliveryAssignment?.method === "PICKUP" ? "DELIVERED" : "IN_TRANSIT";
    const updated = await prisma.$transaction(async (tx) => {
      const j = await tx.fulfillmentJob.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.order.update({ where: { id: j.orderId }, data: { status: nextOrderStatus } });
      if (nextOrderStatus === "IN_TRANSIT" && !deliveryAssignment) {
        await tx.deliveryAssignment.create({
          data: { orderId: j.orderId, method: "COURIER" },
        });
      }

      if (featureFlags.ENABLE_DRM) {
        const orderWithItems = await tx.order.findUnique({
          where: { id: j.orderId },
          include: { items: { include: { designFile: true } } },
        });
        for (const item of orderWithItems?.items ?? []) {
          if (item.designFile?.drmEnabled) {
            const royaltyAmount = item.unitPrice * item.quantity * 0.1;
            await tx.designRoyalty.upsert({
              where: {
                orderId_designFileId_recipientId: {
                  orderId: j.orderId,
                  designFileId: item.designFile.id,
                  recipientId: item.designFile.uploaderId,
                },
              },
              create: {
                designFileId: item.designFile.id,
                orderId: j.orderId,
                recipientId: item.designFile.uploaderId,
                amount: royaltyAmount,
                credits: Math.round(royaltyAmount),
              },
              update: {},
            });
          }
        }
      }

      return j;
    });
    emitToOrder(updated.orderId, "order:status", { status: nextOrderStatus });
    void dispatchWebhooks("order.status_changed", {
      orderId: updated.orderId,
      status: nextOrderStatus,
    });
    return c.json(mapJob(updated), 200);
  });

  app.openapi(rejectJobRoute, async (c) => {
    const { id } = c.req.valid("param");
    const job = await prisma.fulfillmentJob.findUnique({ where: { id } });
    if (!job) return c.json({ code: "NOT_FOUND", message: "Job not found" }, 404) as never;
    if (job.status !== "PENDING")
      return c.json({ code: "INVALID_STATE", message: "Job is not PENDING" }, 400) as never;
    const updated = await prisma.fulfillmentJob.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    const excludeShopIds = await prisma.routingDecision
      .findMany({ where: { orderId: job.orderId, chosen: true } })
      .then((ds) => ds.map((d) => d.shopId).filter((s): s is string => s !== null));
    await routingQueue.add("route-order", { orderId: job.orderId, excludeShopIds });
    return c.json(mapJob(updated), 200);
  });
}
