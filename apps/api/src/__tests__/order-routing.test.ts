import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock BullMQ before any module imports — prevents Redis connection attempts.
// Must use class syntax so `new Queue(...)` / `new Worker(...)` work as constructors.
vi.mock("bullmq", () => ({
  Queue: class {
    add = vi.fn().mockResolvedValue({ id: "mock-job-id" });
    on = vi.fn();
  },
  Worker: class {
    on = vi.fn();
  },
}));

import { app, prisma, processRoutingJob } from "../index";
import { cleanDb, post } from "./helpers";

// ── seed helpers ──────────────────────────────────────────────────────────────

async function seedUser(role: "CONSUMER" | "MAKER" | "ADMIN" = "CONSUMER") {
  return prisma.user.create({
    data: { email: `user-${Date.now()}-${Math.random()}@test.com`, role },
  });
}

async function seedShop(userId: string, opts: { lat?: number; lng?: number; capacity?: number } = {}) {
  return prisma.makerShop.create({
    data: {
      userId,
      name: "Test Shop",
      locationLat: opts.lat ?? -36.85,
      locationLng: opts.lng ?? 174.76,
      active: true,
      capacity: opts.capacity ?? 5,
    },
  });
}

async function seedListing() {
  return prisma.productListing.create({
    data: { title: "Test Part", description: "A 3D printed part", price: 50, currency: "NZD", sourceType: "LOCAL_PRINT", active: true },
  });
}

// ── ORDER PLACEMENT ───────────────────────────────────────────────────────────

describe("POST /orders — order placement", () => {
  afterEach(cleanDb);

  it("creates an order with items and returns 201", async () => {
    const user = await seedUser();
    const listing = await seedListing();

    const { status, body } = await post(app, "/orders", {
      userId: user.id,
      items: [{ listingId: listing.id, quantity: 2, unitPrice: 50 }],
    });

    expect(status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.status).toBe("PENDING");
    expect((body.items as unknown[]).length).toBe(1);
  });

  it("persists the order and its items to the database", async () => {
    const user = await seedUser();
    const listing = await seedListing();

    const { body } = await post(app, "/orders", {
      userId: user.id,
      items: [{ listingId: listing.id, quantity: 1, unitPrice: 50 }],
    });

    const dbOrder = await prisma.order.findUnique({
      where: { id: body.id as string },
      include: { items: true },
    });
    expect(dbOrder).not.toBeNull();
    expect(dbOrder!.items).toHaveLength(1);
    expect(dbOrder!.items[0]!.unitPrice).toBe(50);
  });
});

// ── ROUTING → FULFILLMENT JOB ─────────────────────────────────────────────────

describe("processRoutingJob — routing → fulfillment job creation", () => {
  afterEach(cleanDb);

  it("creates a FulfillmentJob assigned to the highest-scoring shop", async () => {
    const makerUser = await seedUser("MAKER");
    const shop = await seedShop(makerUser.id);
    const consumerUser = await seedUser("CONSUMER");

    const order = await prisma.order.create({
      data: {
        userId: consumerUser.id,
        items: { create: [{ quantity: 1, unitPrice: 30 }] },
      },
      include: { items: true },
    });

    await processRoutingJob(order.id);

    const jobs = await prisma.fulfillmentJob.findMany({ where: { orderId: order.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.shopId).toBe(shop.id);
    expect(jobs[0]!.status).toBe("PENDING");
  });

  it("updates the order status to ROUTED after routing", async () => {
    const makerUser = await seedUser("MAKER");
    await seedShop(makerUser.id);
    const consumerUser = await seedUser("CONSUMER");

    const order = await prisma.order.create({
      data: { userId: consumerUser.id, items: { create: [{ quantity: 1, unitPrice: 20 }] } },
      include: { items: true },
    });

    await processRoutingJob(order.id);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated!.status).toBe("ROUTED");
  });

  it("creates RoutingDecision records for all candidate shops", async () => {
    const m1 = await seedUser("MAKER");
    const m2 = await seedUser("MAKER");
    await seedShop(m1.id, { lat: -36.85, lng: 174.76 });
    await seedShop(m2.id, { lat: -41.29, lng: 174.78 });
    const consumerUser = await seedUser("CONSUMER");

    const order = await prisma.order.create({
      data: { userId: consumerUser.id, items: { create: [{ quantity: 1, unitPrice: 10 }] } },
      include: { items: true },
    });

    await processRoutingJob(order.id);

    const decisions = await prisma.routingDecision.findMany({ where: { orderId: order.id } });
    expect(decisions).toHaveLength(2);
    expect(decisions.filter((d) => d.chosen)).toHaveLength(1);
  });

  it("does not route a cancelled order", async () => {
    const makerUser = await seedUser("MAKER");
    await seedShop(makerUser.id);
    const consumerUser = await seedUser("CONSUMER");

    const order = await prisma.order.create({
      data: { userId: consumerUser.id, status: "CANCELLED", items: { create: [{ quantity: 1, unitPrice: 10 }] } },
      include: { items: true },
    });

    await processRoutingJob(order.id);

    const jobs = await prisma.fulfillmentJob.findMany({ where: { orderId: order.id } });
    expect(jobs).toHaveLength(0);
  });

  it("does not route when no active shops exist", async () => {
    const consumerUser = await seedUser("CONSUMER");
    const order = await prisma.order.create({
      data: { userId: consumerUser.id, items: { create: [{ quantity: 1, unitPrice: 10 }] } },
      include: { items: true },
    });

    await processRoutingJob(order.id);

    const jobs = await prisma.fulfillmentJob.findMany({ where: { orderId: order.id } });
    expect(jobs).toHaveLength(0);
  });
});

// ── CREDIT DEDUCTION ──────────────────────────────────────────────────────────

describe("POST /orders — credit deduction", () => {
  beforeEach(() => {
    process.env.ENABLE_CREDITS = "true";
  });
  afterEach(cleanDb);

  it("deducts credits from account when useCredits=true and balance is sufficient", async () => {
    const user = await seedUser();
    const listing = await seedListing();

    // Give the user a credit balance
    await prisma.creditAccount.create({ data: { userId: user.id, balance: 200 } });

    await post(app, "/orders", {
      userId: user.id,
      useCredits: true,
      items: [{ listingId: listing.id, quantity: 1, unitPrice: 50 }],
    });

    const account = await prisma.creditAccount.findUnique({ where: { userId: user.id } });
    expect(account!.balance).toBe(150);
  });

  it("creates a SPENT credit transaction record", async () => {
    const user = await seedUser();
    const listing = await seedListing();
    await prisma.creditAccount.create({ data: { userId: user.id, balance: 100 } });

    const { body } = await post(app, "/orders", {
      userId: user.id,
      useCredits: true,
      items: [{ listingId: listing.id, quantity: 1, unitPrice: 40 }],
    });

    const tx = await prisma.creditTransaction.findFirst({
      where: { note: `Order ${body.id as string}`, type: "SPENT" },
    });
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(-40);
  });

  it("does not deduct credits when balance is insufficient", async () => {
    const user = await seedUser();
    const listing = await seedListing();
    await prisma.creditAccount.create({ data: { userId: user.id, balance: 10 } });

    await post(app, "/orders", {
      userId: user.id,
      useCredits: true,
      items: [{ listingId: listing.id, quantity: 1, unitPrice: 50 }],
    });

    const account = await prisma.creditAccount.findUnique({ where: { userId: user.id } });
    expect(account!.balance).toBe(10); // unchanged
  });
});

// ── DRM ROYALTY ON JOB COMPLETION ─────────────────────────────────────────────

describe("POST /fulfillment-jobs/:id/complete — DRM royalty", () => {
  beforeEach(() => {
    process.env.ENABLE_DRM = "true";
  });
  afterEach(cleanDb);

  it("creates a DesignRoyalty record when a DRM-enabled design is in the order", async () => {
    const designer = await seedUser("MAKER");
    const consumer = await seedUser("CONSUMER");
    const shop = await seedShop(designer.id);

    const designFile = await prisma.designFile.create({
      data: { uploaderId: designer.id, fileKey: `designs/test-${Date.now()}.stl`, fileType: "model/stl", drmEnabled: true },
    });

    const order = await prisma.order.create({
      data: {
        userId: consumer.id,
        status: "IN_PRODUCTION",
        items: { create: [{ designFileId: designFile.id, quantity: 1, unitPrice: 100 }] },
      },
    });

    const job = await prisma.fulfillmentJob.create({
      data: { orderId: order.id, shopId: shop.id, status: "ACCEPTED", acceptedAt: new Date() },
    });

    const { status } = await post(app, `/fulfillment-jobs/${job.id}/complete`, {});
    expect(status).toBe(200);

    const royalty = await prisma.designRoyalty.findFirst({ where: { orderId: order.id } });
    expect(royalty).not.toBeNull();
    expect(royalty!.designFileId).toBe(designFile.id);
    expect(royalty!.recipientId).toBe(designer.id);
    expect(royalty!.amount).toBe(10); // 10% of 100
  });

  it("does not create a royalty for non-DRM design files", async () => {
    const designer = await seedUser("MAKER");
    const consumer = await seedUser("CONSUMER");
    const shop = await seedShop(designer.id);

    const designFile = await prisma.designFile.create({
      data: { uploaderId: designer.id, fileKey: `designs/open-${Date.now()}.stl`, fileType: "model/stl", drmEnabled: false },
    });

    const order = await prisma.order.create({
      data: {
        userId: consumer.id,
        status: "IN_PRODUCTION",
        items: { create: [{ designFileId: designFile.id, quantity: 1, unitPrice: 100 }] },
      },
    });

    const job = await prisma.fulfillmentJob.create({
      data: { orderId: order.id, shopId: shop.id, status: "ACCEPTED", acceptedAt: new Date() },
    });

    await post(app, `/fulfillment-jobs/${job.id}/complete`, {});

    const royalties = await prisma.designRoyalty.findMany({ where: { orderId: order.id } });
    expect(royalties).toHaveLength(0);
  });
});
