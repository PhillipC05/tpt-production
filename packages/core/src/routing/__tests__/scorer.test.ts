import { describe, it, expect } from "vitest";
import {
  clamp,
  distanceKm,
  scoreGeo,
  scoreCost,
  scoreCapacity,
  scoreCapability,
  calculateTotalScore,
} from "../scorer";
import type { OrderInput, RoutingCandidate } from "@tpt/types";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    id: "order-1",
    userId: "user-1",
    status: "PENDING",
    items: [],
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<RoutingCandidate> = {}): RoutingCandidate {
  return {
    id: "shop-1",
    shopId: "shop-1",
    location: { lat: 0, lng: 0 },
    active: true,
    capacity: 5,
    capabilities: [],
    ...overrides,
  };
}

// ── clamp ─────────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it("clamps to min", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
  });

  it("clamps to max", () => {
    expect(clamp(2, 0, 1)).toBe(1);
  });

  it("handles equal min and max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

// ── distanceKm ────────────────────────────────────────────────────────────────

describe("distanceKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBeCloseTo(0);
  });

  it("returns known distance for Auckland → Wellington (~490 km)", () => {
    const auckland = { lat: -36.85, lng: 174.76 };
    const wellington = { lat: -41.29, lng: 174.78 };
    expect(distanceKm(auckland, wellington)).toBeCloseTo(490, -1);
  });

  it("returns Infinity when origin is undefined", () => {
    expect(distanceKm(undefined, { lat: 0, lng: 0 })).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns Infinity when destination is undefined", () => {
    expect(distanceKm({ lat: 0, lng: 0 }, undefined)).toBe(Number.POSITIVE_INFINITY);
  });

  it("returns Infinity when coordinates contain NaN", () => {
    expect(distanceKm({ lat: NaN, lng: 0 }, { lat: 0, lng: 0 })).toBe(Number.POSITIVE_INFINITY);
  });
});

// ── scoreGeo ──────────────────────────────────────────────────────────────────

describe("scoreGeo", () => {
  it("returns 1.0 for co-located order and shop", () => {
    const order = makeOrder({ deliveryAddress: { lat: 0, lng: 0 } });
    const candidate = makeCandidate({ location: { lat: 0, lng: 0 } });
    expect(scoreGeo(order, candidate)).toBe(1);
  });

  it("returns 0 for distance >= 100 km (normalization threshold)", () => {
    // ~111 km per degree of latitude
    const order = makeOrder({ deliveryAddress: { lat: 0, lng: 0 } });
    const candidate = makeCandidate({ location: { lat: 1, lng: 0 } }); // ~111 km
    expect(scoreGeo(order, candidate)).toBe(0);
  });

  it("returns 0.5 when delivery address is missing", () => {
    const order = makeOrder({ deliveryAddress: undefined });
    const candidate = makeCandidate({ location: { lat: 0, lng: 0 } });
    expect(scoreGeo(order, candidate)).toBe(0.5);
  });

  it("returns a value between 0 and 1 for partial distance", () => {
    const order = makeOrder({ deliveryAddress: { lat: 0, lng: 0 } });
    const candidate = makeCandidate({ location: { lat: 0.5, lng: 0 } }); // ~55 km
    const score = scoreGeo(order, candidate);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

// ── scoreCost ─────────────────────────────────────────────────────────────────

describe("scoreCost", () => {
  it("returns 1.0 for zero cost", () => {
    expect(scoreCost(makeCandidate({ costEstimate: 0 }))).toBe(1);
  });

  it("returns 0.5 when costEstimate is undefined", () => {
    expect(scoreCost(makeCandidate({ costEstimate: undefined }))).toBe(0.5);
  });

  it("returns 0 when cost equals maxCost", () => {
    expect(scoreCost(makeCandidate({ costEstimate: 100 }), 100)).toBe(0);
  });

  it("returns 0.5 when cost is half of maxCost", () => {
    expect(scoreCost(makeCandidate({ costEstimate: 50 }), 100)).toBe(0.5);
  });

  it("clamps to 0 when cost exceeds maxCost", () => {
    expect(scoreCost(makeCandidate({ costEstimate: 150 }), 100)).toBe(0);
  });

  it("returns positive score without maxCost (self-normalised)", () => {
    const score = scoreCost(makeCandidate({ costEstimate: 10 }));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("returns 0.5 for negative cost (invalid)", () => {
    expect(scoreCost(makeCandidate({ costEstimate: -5 }))).toBe(0.5);
  });
});

// ── scoreCapacity ─────────────────────────────────────────────────────────────

describe("scoreCapacity", () => {
  it("returns 1.0 for capacity >= 10 (normalization ceiling)", () => {
    expect(scoreCapacity(makeCandidate({ capacity: 10 }))).toBe(1);
    expect(scoreCapacity(makeCandidate({ capacity: 20 }))).toBe(1);
  });

  it("returns 0 for capacity <= 0", () => {
    expect(scoreCapacity(makeCandidate({ capacity: 0 }))).toBe(0);
    expect(scoreCapacity(makeCandidate({ capacity: -1 }))).toBe(0);
  });

  it("returns 0.5 for capacity = 5", () => {
    expect(scoreCapacity(makeCandidate({ capacity: 5 }))).toBe(0.5);
  });

  it("returns 0.5 when capacity is undefined", () => {
    expect(scoreCapacity(makeCandidate({ capacity: undefined }))).toBe(0.5);
  });
});

// ── scoreCapability ───────────────────────────────────────────────────────────

describe("scoreCapability", () => {
  it("returns 0.5 when order has no requirements", () => {
    const order = makeOrder({ items: [{ quantity: 1, unitPrice: 10 }] });
    const candidate = makeCandidate();
    expect(scoreCapability(order, candidate)).toBe(0.5);
  });

  it("returns 0 when candidate has no capabilities but order requires them", () => {
    const order = makeOrder({
      items: [{ quantity: 1, unitPrice: 10, material: "PLA" }],
    });
    const candidate = makeCandidate({ capabilities: [] });
    expect(scoreCapability(order, candidate)).toBe(0);
  });

  it("returns 1.0 when all requirements are matched", () => {
    const order = makeOrder({
      items: [{ quantity: 1, unitPrice: 10, material: "PLA", machineType: "FDM" }],
    });
    const candidate = makeCandidate({
      capabilities: [
        { id: "c1", shopId: "shop-1", material: "PLA", machineType: "FDM", category: "prototyping", createdAt: new Date().toISOString() },
      ],
    });
    expect(scoreCapability(order, candidate)).toBe(1);
  });

  it("returns partial score when only some requirements are matched", () => {
    const order = makeOrder({
      items: [
        { quantity: 1, unitPrice: 10, material: "PLA" },
        { quantity: 1, unitPrice: 20, material: "Resin" },
      ],
    });
    const candidate = makeCandidate({
      capabilities: [
        { id: "c1", shopId: "shop-1", material: "PLA", machineType: "FDM", category: "printing", createdAt: new Date().toISOString() },
      ],
    });
    expect(scoreCapability(order, candidate)).toBe(0.5);
  });

  it("ignores undefined requirement fields in matching", () => {
    const order = makeOrder({
      items: [{ quantity: 1, unitPrice: 10, material: "PLA" }],
    });
    const candidate = makeCandidate({
      capabilities: [
        { id: "c1", shopId: "shop-1", material: "PLA", machineType: "SLA", category: "other", createdAt: new Date().toISOString() },
      ],
    });
    // requirement only specifies material — machineType mismatch is irrelevant
    expect(scoreCapability(order, candidate)).toBe(1);
  });
});

// ── calculateTotalScore ───────────────────────────────────────────────────────

describe("calculateTotalScore", () => {
  const defaultWeights = { geo: 0.35, cost: 0.25, capacity: 0.25, capability: 0.15 };

  it("returns 1.0 when all component scores are 1", () => {
    expect(
      calculateTotalScore(
        { geoScore: 1, costScore: 1, capacityScore: 1, capabilityScore: 1 },
        defaultWeights,
      ),
    ).toBe(1);
  });

  it("returns 0 when all component scores are 0", () => {
    expect(
      calculateTotalScore(
        { geoScore: 0, costScore: 0, capacityScore: 0, capabilityScore: 0 },
        defaultWeights,
      ),
    ).toBe(0);
  });

  it("weighs geo most heavily with default weights", () => {
    const geoOnly = calculateTotalScore(
      { geoScore: 1, costScore: 0, capacityScore: 0, capabilityScore: 0 },
      defaultWeights,
    );
    const costOnly = calculateTotalScore(
      { geoScore: 0, costScore: 1, capacityScore: 0, capabilityScore: 0 },
      defaultWeights,
    );
    expect(geoOnly).toBeGreaterThan(costOnly);
  });

  it("clamps result to [0, 1] even with out-of-range inputs", () => {
    const score = calculateTotalScore(
      { geoScore: 2, costScore: 2, capacityScore: 2, capabilityScore: 2 },
      defaultWeights,
    );
    expect(score).toBe(1);
  });
});
