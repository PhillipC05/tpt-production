// ── Environment bootstrap (must run before prisma/queues are imported) ─────────
import "./lib/env";

import { serve } from "@hono/node-server";
import { Server as SocketServer } from "socket.io";
import { Queue, Worker } from "bullmq";
import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { log } from "./lib/logger";
import { redisConnection, getPort } from "./lib/env";
import { routingQueue, decayPriceQueue } from "./lib/queues";
import { setSocketServer } from "./lib/sockets";
import { startRoutingWorker, processRoutingJob } from "./workers/routing";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const app = createApp();

// ── Price decay BullMQ cron job ───────────────────────────────────────────────
void decayPriceQueue.add(
  "recalculate-decay-prices",
  {},
  { repeat: { pattern: "0 0 * * *" }, jobId: "decay-daily" },
);

async function processDecayPrices() {
  const { evaluatePriceDecay } = await import("@tpt/core/pricing/decay");
  const rules = await prisma.pricingRule.findMany({
    where: { type: "DECAY" },
    include: { listing: true },
  });

  const now = new Date();
  for (const rule of rules) {
    if (!rule.decaySchedule || typeof rule.decaySchedule !== "object") continue;
    const schedule = rule.decaySchedule as {
      startDate?: string;
      endDate?: string;
      startPrice?: number;
      endPrice?: number;
    };
    if (
      !schedule.startDate ||
      !schedule.endDate ||
      typeof schedule.startPrice !== "number" ||
      typeof schedule.endPrice !== "number"
    )
      continue;
    const { price } = evaluatePriceDecay(
      {
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        startPrice: schedule.startPrice,
        endPrice: schedule.endPrice,
      },
      now,
    );
    await prisma.productListing.update({ where: { id: rule.listingId }, data: { price } });
  }
}

const decayDlq = new Queue("decay-price-dlq", { connection: redisConnection });

const decayWorker = new Worker(
  "decay-price-queue",
  async () => {
    await processDecayPrices();
  },
  { connection: redisConnection, removeOnFail: { count: 50 } },
);

decayWorker.on("failed", (job, err: Error) => {
  log.error(
    { jobId: job?.id, attempt: job?.attemptsMade, err: err.message },
    "decay-price job failed",
  );
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    void decayDlq.add("decay-failed", {
      error: err.message,
      failedAt: new Date().toISOString(),
    });
  }
});

// ── Routing worker ────────────────────────────────────────────────────────────
const routingDlq = new Queue("routing-dlq", { connection: redisConnection });

const routingWorker = startRoutingWorker();

routingWorker.on("failed", (job, err: Error) => {
  log.error(
    {
      jobId: job?.id,
      orderId: (job?.data as { orderId?: string } | undefined)?.orderId,
      attempt: job?.attemptsMade,
      err: err.message,
    },
    "routing job failed",
  );
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    void routingDlq.add("routing-failed", {
      originalData: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
  }
});

// ── Server startup ────────────────────────────────────────────────────────────
const shouldServe =
  process.env.NODE_ENV !== "test" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (shouldServe) {
  const port = getPort();
  const server = serve(
    {
      fetch: app.fetch,
      port,
      hostname: "0.0.0.0",
    },
    (info) => {
      log.info({ port: info.port }, `TPT API listening on http://localhost:${info.port}`);
      log.info(`OpenAPI: http://localhost:${info.port}/openapi.json`);
      log.info(`Docs: http://localhost:${info.port}/docs`);
    },
  );

  const io = new SocketServer(server as never, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  setSocketServer(io);

  io.on("connection", (socket) => {
    socket.on("join-order", (orderId: string) => {
      if (typeof orderId === "string" && orderId.length > 0) {
        void socket.join(`order:${orderId}`);
      }
    });
  });
}

// Keep these exported for tests that reference them directly
export { routingQueue };
export { log };
export { prisma };
export { processRoutingJob };
