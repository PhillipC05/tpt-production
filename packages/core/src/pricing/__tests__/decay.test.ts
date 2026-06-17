import { describe, it, expect } from "vitest";
import { evaluatePriceDecay } from "../decay";

function makeSchedule(overrides: Partial<Parameters<typeof evaluatePriceDecay>[0]> = {}) {
  return {
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    startPrice: 100,
    endPrice: 10,
    ...overrides,
  };
}

// ── boundary conditions ───────────────────────────────────────────────────────

describe("evaluatePriceDecay — boundary", () => {
  it("returns startPrice and progress=0 when now is before startDate", () => {
    const result = evaluatePriceDecay(makeSchedule(), new Date("2023-12-31"));
    expect(result.price).toBe(100);
    expect(result.progress).toBe(0);
  });

  it("returns endPrice and progress=1 when now is after endDate", () => {
    const result = evaluatePriceDecay(makeSchedule(), new Date("2025-01-01"));
    expect(result.price).toBe(10);
    expect(result.progress).toBe(1);
  });

  it("returns endPrice when startDate === endDate (degenerate range)", () => {
    const result = evaluatePriceDecay(
      makeSchedule({ startDate: "2024-06-01", endDate: "2024-06-01" }),
      new Date("2024-06-01"),
    );
    expect(result.price).toBe(10);
  });

  it("clamps price to 0 when endPrice is negative", () => {
    const result = evaluatePriceDecay(
      makeSchedule({ endPrice: -50 }),
      new Date("2025-01-01"),
    );
    expect(result.price).toBe(0);
  });
});

// ── linear curve ──────────────────────────────────────────────────────────────

describe("evaluatePriceDecay — linear", () => {
  it("returns midpoint price at 50% progress", () => {
    const mid = new Date("2024-07-02"); // approximately midpoint of 2024
    const result = evaluatePriceDecay(makeSchedule({ curve: "linear" }), mid);
    expect(result.price).toBeCloseTo(55, 0);
    expect(result.progress).toBeCloseTo(0.5, 1);
    expect(result.curve).toBe("linear");
  });

  it("defaults to linear when curve is omitted", () => {
    const mid = new Date("2024-07-02");
    const result = evaluatePriceDecay(makeSchedule(), mid);
    expect(result.curve).toBe("linear");
  });
});

// ── exponential curve ─────────────────────────────────────────────────────────

describe("evaluatePriceDecay — exponential", () => {
  it("starts slower than linear at 25% progress", () => {
    const quarter = new Date("2024-04-01");
    const linear = evaluatePriceDecay(makeSchedule({ curve: "linear" }), quarter);
    const exp = evaluatePriceDecay(makeSchedule({ curve: "exponential" }), quarter);
    // exponential easing means price drops faster early → lower price at 25%
    expect(exp.price).toBeLessThan(linear.price);
  });

  it("returns a value between startPrice and endPrice at midpoint", () => {
    const mid = new Date("2024-07-02");
    const result = evaluatePriceDecay(makeSchedule({ curve: "exponential" }), mid);
    expect(result.price).toBeGreaterThanOrEqual(10);
    expect(result.price).toBeLessThanOrEqual(100);
  });
});

// ── step curve ────────────────────────────────────────────────────────────────

describe("evaluatePriceDecay — step", () => {
  const stepSchedule = makeSchedule({
    curve: "step",
    steps: [
      { at: 0, price: 100 },
      { at: 0.5, price: 60 },
      { at: 0.75, price: 30 },
    ],
  });

  it("snaps to first step before 50%", () => {
    const early = new Date("2024-03-01"); // ~16%
    const result = evaluatePriceDecay(stepSchedule, early);
    expect(result.price).toBe(100);
  });

  it("snaps to second step between 50% and 75%", () => {
    const mid = new Date("2024-07-15"); // ~54%
    const result = evaluatePriceDecay(stepSchedule, mid);
    expect(result.price).toBe(60);
  });

  it("snaps to third step after 75%", () => {
    const late = new Date("2024-11-01"); // ~83%
    const result = evaluatePriceDecay(stepSchedule, late);
    expect(result.price).toBe(30);
  });

  it("falls back to linear when steps are undefined", () => {
    const mid = new Date("2024-07-02");
    const result = evaluatePriceDecay(
      makeSchedule({ curve: "step", steps: undefined }),
      mid,
    );
    expect(result.price).toBeCloseTo(55, 0);
  });
});
