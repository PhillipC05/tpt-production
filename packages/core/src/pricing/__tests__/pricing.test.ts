import { describe, it, expect } from "vitest";
import { ResolvePrice, resolvePrice } from "../index";
import type { FeatureFlags } from "../../flags";
import type { ProductListing } from "@tpt/types";
import { PricingRuleType, SourceType } from "@tpt/types";

// ── helpers ───────────────────────────────────────────────────────────────────

const OFF: FeatureFlags = {
  ENABLE_CREDITS: false,
  ENABLE_DRM: false,
  ENABLE_PAYMENTS: false,
  ENABLE_FREE_ECONOMY: false,
  ENABLE_PRICE_DECAY: false,
  ENABLE_AI_AGENTS: false,
};

const FREE_ECONOMY: FeatureFlags = { ...OFF, ENABLE_FREE_ECONOMY: true };
const DECAY_ON: FeatureFlags = { ...OFF, ENABLE_PRICE_DECAY: true };

function makeListing(overrides: Partial<ProductListing> = {}): ProductListing {
  return {
    id: "listing-1",
    title: "Test Part",
    description: "A test listing",
    price: 50,
    currency: "NZD",
    sourceType: SourceType.LOCAL_PRINT,
    active: true,
    pricingRules: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── ResolvePrice ──────────────────────────────────────────────────────────────

describe("ResolvePrice", () => {
  it("returns listing.price when no rules and economy is off", () => {
    expect(ResolvePrice(makeListing({ price: 50 }), OFF)).toBe(50);
  });

  it("returns 0 when ENABLE_FREE_ECONOMY is on", () => {
    expect(ResolvePrice(makeListing({ price: 50 }), FREE_ECONOMY)).toBe(0);
  });

  it("returns 0 when listing has a FREE pricing rule", () => {
    const listing = makeListing({
      pricingRules: [
        { id: "r1", listingId: "listing-1", type: PricingRuleType.FREE, decaySchedule: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
    });
    expect(ResolvePrice(listing, OFF)).toBe(0);
  });

  it("clamps price to 0 when listing.price is negative", () => {
    expect(ResolvePrice(makeListing({ price: -10 }), OFF)).toBe(0);
  });

  it("returns decayed price when ENABLE_PRICE_DECAY is on and decay rule exists", () => {
    const listing = makeListing({
      price: 100,
      pricingRules: [
        {
          id: "r1",
          listingId: "listing-1",
          type: PricingRuleType.DECAY,
          decaySchedule: {
            startDate: "2024-01-01",
            endDate: "2024-12-31",
            startPrice: 100,
            endPrice: 10,
            curve: "linear",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const atEnd = new Date("2025-01-01");
    expect(ResolvePrice(listing, DECAY_ON, { now: atEnd })).toBe(10);
  });

  it("ignores decay rule when ENABLE_PRICE_DECAY is off", () => {
    const listing = makeListing({
      price: 75,
      pricingRules: [
        {
          id: "r1",
          listingId: "listing-1",
          type: PricingRuleType.DECAY,
          decaySchedule: { startDate: "2024-01-01", endDate: "2024-12-31", startPrice: 100, endPrice: 10 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    expect(ResolvePrice(listing, OFF)).toBe(75);
  });

  it("FREE_ECONOMY overrides explicit FREE rule (both return 0)", () => {
    const listing = makeListing({
      pricingRules: [
        { id: "r1", listingId: "listing-1", type: PricingRuleType.FREE, decaySchedule: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
    });
    expect(ResolvePrice(listing, FREE_ECONOMY)).toBe(0);
  });
});

// ── resolvePrice (breakdown) ──────────────────────────────────────────────────

describe("resolvePrice", () => {
  it("includes listingId and currency in breakdown", () => {
    const breakdown = resolvePrice(makeListing({ price: 30, currency: "USD" }), OFF);
    expect(breakdown.listingId).toBe("listing-1");
    expect(breakdown.currency).toBe("USD");
    expect(breakdown.price).toBe(30);
  });

  it("sets ruleType to FREE when free economy is enabled", () => {
    const breakdown = resolvePrice(makeListing(), FREE_ECONOMY);
    expect(breakdown.ruleType).toBe(PricingRuleType.FREE);
    expect(breakdown.price).toBe(0);
  });

  it("sets ruleType to FREE when listing has FREE rule", () => {
    const listing = makeListing({
      pricingRules: [
        { id: "r1", listingId: "listing-1", type: PricingRuleType.FREE, decaySchedule: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],
    });
    const breakdown = resolvePrice(listing, OFF);
    expect(breakdown.ruleType).toBe(PricingRuleType.FREE);
  });

  it("includes decay breakdown when decay is active", () => {
    const listing = makeListing({
      pricingRules: [
        {
          id: "r1",
          listingId: "listing-1",
          type: PricingRuleType.DECAY,
          decaySchedule: {
            startDate: "2024-01-01",
            endDate: "2024-12-31",
            startPrice: 100,
            endPrice: 10,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const breakdown = resolvePrice(listing, DECAY_ON, { now: new Date("2025-01-01") });
    expect(breakdown.ruleType).toBe(PricingRuleType.DECAY);
    expect(breakdown.decay).toBeDefined();
    expect(breakdown.decay?.price).toBe(10);
    expect(breakdown.decay?.progress).toBe(1);
  });

  it("omits decay field when decay rule is present but flag is off", () => {
    const listing = makeListing({
      pricingRules: [
        {
          id: "r1",
          listingId: "listing-1",
          type: PricingRuleType.DECAY,
          decaySchedule: { startDate: "2024-01-01", endDate: "2024-12-31", startPrice: 100, endPrice: 10 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const breakdown = resolvePrice(listing, OFF);
    expect(breakdown.decay).toBeUndefined();
  });
});
