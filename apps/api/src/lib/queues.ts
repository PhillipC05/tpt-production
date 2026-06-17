import { Queue } from "bullmq";
import { redisConnection } from "./env";

export const routingQueue = new Queue("routing-queue", { connection: redisConnection });
export const decayPriceQueue = new Queue("decay-price-queue", { connection: redisConnection });

export async function enqueueOrderRoutingJob(orderId: string) {
  await routingQueue.add("route-order", { orderId });
}
