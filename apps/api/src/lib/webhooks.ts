import { createHmac } from "node:crypto";
import { log } from "./logger";
import { prisma } from "./prisma";

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  if (expected.length !== signature.length) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function dispatchWebhooks(event: string, payload: unknown): Promise<void> {
  let webhooks: Array<{ id: string; url: string; secret: string; events: string }>;
  try {
    webhooks = await prisma.webhook.findMany({ where: { active: true } });
  } catch {
    return;
  }

  const filtered = webhooks.filter((wh) => {
    if (!wh.events) return true;
    return wh.events.split(",").some((e) => e.trim() === event);
  });
  if (filtered.length === 0) return;

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  await Promise.allSettled(
    filtered.map(async (wh) => {
      const sig = `sha256=${createHmac("sha256", wh.secret).update(body).digest("hex")}`;
      try {
        await fetch(wh.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-TPT-Signature": sig,
            "X-TPT-Event": event,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });
      } catch (err) {
        log.debug({ err, webhookId: wh.id, event }, "webhook dispatch failed");
      }
    }),
  );
}