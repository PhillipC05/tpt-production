import { Worker } from "bullmq";
import type { OrderInput, RoutingCandidate } from "@tpt/types";
import { routeOrder } from "@tpt/core/routing";
import { redisConnection } from "../lib/env";
import { routingQueue } from "../lib/queues";
import { prisma } from "../lib/prisma";
import { callAiScorer } from "../lib/ai-scorer";

function toRoutingCandidate(shop: {
  id: string;
  name: string | null;
  locationLat: number | null;
  locationLng: number | null;
  active: boolean;
  capacity: number;
}): RoutingCandidate {
  const candidate: RoutingCandidate = {
    id: shop.id,
    shopId: shop.id,
    active: shop.active,
    capacity: shop.capacity,
  };

  if (shop.locationLat !== null && shop.locationLng !== null) {
    const location = { lat: shop.locationLat, lng: shop.locationLng };
    candidate.location = location;
    candidate.shop = {
      id: shop.id,
      active: shop.active,
      capacity: shop.capacity,
      location,
    };
    if (shop.name !== null) candidate.shop.name = shop.name;
  } else if (shop.name !== null) {
    candidate.shop = {
      id: shop.id,
      name: shop.name,
      active: shop.active,
      capacity: shop.capacity,
    };
  }

  return candidate;
}

function toOrderInput(order: {
  id: string;
  userId: string;
  status: string;
  items: { listingId: string | null; designFileId: string | null; quantity: number; unitPrice: number }[];
}): OrderInput {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status as OrderInput["status"],
    items: order.items.map((item) => {
      const orderItem: OrderInput["items"][number] = {
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      };
      if (item.listingId !== null) orderItem.listingId = item.listingId;
      if (item.designFileId !== null) orderItem.designFileId = item.designFileId;
      return orderItem;
    }),
  };
}

export async function processRoutingJob(orderId: string, excludeShopIds: string[] = []) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);

  // Do not route cancelled orders
  if (order.status === "CANCELLED") return;

  const orderInput = toOrderInput(order);
  const shops = await prisma.makerShop.findMany({
    where: { active: true, ...(excludeShopIds.length > 0 ? { id: { notIn: excludeShopIds } } : {}) },
  });
  const candidates = shops.map(toRoutingCandidate);
  const aiScores = new Map<string, number>();

  await Promise.all(
    candidates.map(async (candidate) => {
      aiScores.set(candidate.id, await callAiScorer(candidate, orderInput));
    }),
  );

  const results = routeOrder(orderInput, candidates, {
    customScorer: (candidate) => aiScores.get(candidate.id) ?? 0,
  });

  await prisma.routingDecision.deleteMany({ where: { orderId } });
  await prisma.routingDecision.createMany({
    data: results.map((result) => ({
      orderId,
      shopId: result.shopId ?? null,
      geoScore: result.geoScore,
      costScore: result.costScore,
      capacityScore: result.capacityScore,
      capabilityScore: result.capabilityScore,
      totalScore: result.totalScore,
      chosen: result.chosen,
    })),
  });

  const chosen = results.find((result) => result.chosen);
  if (chosen?.shopId) {
    await prisma.order.update({ where: { id: orderId }, data: { status: "ROUTED" } });
    await prisma.fulfillmentJob.create({ data: { orderId, shopId: chosen.shopId, status: "PENDING" } });
  }
}

export function startRoutingWorker() {
  return new Worker(
    routingQueue.name,
    async (job) => {
      await processRoutingJob(String(job.data.orderId));
    },
    { connection: redisConnection, concurrency: 2 },
  );
}