import { prisma } from "../index";

/** Wipe all data in dependency order. Call in afterEach. */
export async function cleanDb() {
  await prisma.designRoyalty.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.creditAccount.deleteMany();
  await prisma.routingDecision.deleteMany();
  await prisma.fulfillmentJob.deleteMany();
  await prisma.deliveryAssignment.deleteMany();
  await prisma.trackingEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.designFile.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.productListing.deleteMany();
  await prisma.shopCapability.deleteMany();
  await prisma.makerShop.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.customOrderRequest.deleteMany();
  await prisma.user.deleteMany();
}

type FetchApp = { fetch: (req: Request) => Response | Promise<Response> };

/** POST to the Hono app and return parsed JSON + status. */
export async function post(app: FetchApp, url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await app.fetch(
    new Request(`http://localhost${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

/** GET from the Hono app and return parsed JSON + status. */
export async function get(app: FetchApp, url: string, headers: Record<string, string> = {}) {
  const res = await app.fetch(
    new Request(`http://localhost${url}`, { headers }),
  );
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}
