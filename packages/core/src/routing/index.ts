import type { OrderInput, RoutingCandidate, RoutingResult } from "@tpt/types";
import type { RoutingWeights } from "./weights";
import {
  calculateTotalScore,
  scoreCapability,
  scoreCapacity,
  scoreCost,
  scoreGeo,
} from "./scorer";
import { normalizeWeights, resolveRoutingWeights } from "./weights";

export interface RouteOrderContext {
  order: OrderInput;
  candidate: RoutingCandidate;
  weights: RoutingWeights;
  maxCost?: number;
  now?: Date;
}

export interface RouteOrderOptions {
  weights?: RoutingWeights;
  includeInactive?: boolean;
  now?: Date;
  customScorer?: (
    candidate: RoutingCandidate,
    context: RouteOrderContext,
  ) => number;
}

interface ScoredCandidate {
  candidate: RoutingCandidate;
  geoScore: number;
  costScore: number;
  capacityScore: number;
  capabilityScore: number;
  totalScore: number;
}

export function routeOrder(
  order: OrderInput,
  candidates: RoutingCandidate[],
  options: RouteOrderOptions = {},
): RoutingResult[] {
  const weights = normalizeWeights(
    options.weights ?? resolveRoutingWeights(),
  );
  const finiteCosts = candidates
    .map((candidate) => candidate.costEstimate)
    .filter(
      (cost): cost is number =>
        typeof cost === "number" && Number.isFinite(cost),
    );
  const maxCost =
    finiteCosts.length > 0 ? Math.max(...finiteCosts) : undefined;

  const scoredCandidates = candidates
    .filter((candidate) => options.includeInactive || candidate.active !== false)
    .map((candidate): ScoredCandidate => {
      const geoScore = scoreGeo(order, candidate);
      const costScore = scoreCost(candidate, maxCost);
      const capacityScore = scoreCapacity(candidate);
      const capabilityScore = scoreCapability(order, candidate);
      const context: RouteOrderContext = {
        order,
        candidate,
        weights,
      };

      if (maxCost !== undefined) {
        context.maxCost = maxCost;
      }

      if (options.now !== undefined) {
        context.now = options.now;
      }

      const customScore = options.customScorer?.(candidate, context) ?? 0;

      return {
        candidate,
        geoScore,
        costScore,
        capacityScore,
        capabilityScore,
        totalScore: calculateTotalScore(
          {
            geoScore,
            costScore,
            capacityScore,
            capabilityScore: capabilityScore + customScore,
          },
          weights,
        ),
      };
    })
    .sort((left, right) => right.totalScore - left.totalScore);

  return scoredCandidates.map((entry, index) => {
    const result: RoutingResult = {
      candidateId: entry.candidate.id,
      geoScore: entry.geoScore,
      costScore: entry.costScore,
      capacityScore: entry.capacityScore,
      capabilityScore: entry.capabilityScore,
      totalScore: entry.totalScore,
      chosen: index === 0,
      rank: index + 1,
    };

    if (entry.candidate.shopId !== undefined) {
      result.shopId = entry.candidate.shopId;
    }

    if (entry.candidate.supplierId !== undefined) {
      result.supplierId = entry.candidate.supplierId;
    }

    if (index === 0) {
      result.reason = "Highest weighted routing score";
    }

    return result;
  });
}

export function RouteOrder(
  order: OrderInput,
  candidates: RoutingCandidate[],
  options?: RouteOrderOptions,
): RoutingResult[] {
  return routeOrder(order, candidates, options);
}