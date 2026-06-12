import type {
  PriceDecaySchedule,
  ProductListing,
  ResolvePriceBreakdown,
} from "@tpt/types";
import { PricingRuleType as PricingRuleTypeValues } from "@tpt/types";
import type { FeatureFlags } from "../flags";
import { featureFlags as defaultFeatureFlags } from "../flags";
import { evaluatePriceDecay } from "./decay";

export interface ResolvePriceOptions {
  now?: Date;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPriceDecaySchedule(value: unknown): value is PriceDecaySchedule {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const schedule = value as Partial<PriceDecaySchedule>;

  return (
    (typeof schedule.startDate === "string" ||
      schedule.startDate instanceof Date) &&
    (typeof schedule.endDate === "string" ||
      schedule.endDate instanceof Date) &&
    isFiniteNumber(schedule.startPrice) &&
    isFiniteNumber(schedule.endPrice)
  );
}

export function ResolvePrice(
  listing: ProductListing,
  flags: FeatureFlags = defaultFeatureFlags,
  options: ResolvePriceOptions = {},
): number {
  if (flags.ENABLE_FREE_ECONOMY) {
    return 0;
  }

  const freeRule = listing.pricingRules?.find(
    (rule) => rule.type === PricingRuleTypeValues.FREE,
  );

  if (freeRule !== undefined) {
    return 0;
  }

  const decayRule = listing.pricingRules?.find(
    (rule) => rule.type === PricingRuleTypeValues.DECAY,
  );

  if (
    flags.ENABLE_PRICE_DECAY &&
    decayRule !== undefined &&
    isPriceDecaySchedule(decayRule.decaySchedule)
  ) {
    return evaluatePriceDecay(decayRule.decaySchedule, options.now).price;
  }

  return Math.max(0, listing.price);
}

export function resolvePrice(
  listing: ProductListing,
  flags: FeatureFlags = defaultFeatureFlags,
  options: ResolvePriceOptions = {},
): ResolvePriceBreakdown {
  const price = ResolvePrice(listing, flags, options);
  const breakdown: ResolvePriceBreakdown = {
    listingId: listing.id,
    price,
    currency: listing.currency,
  };

  if (flags.ENABLE_FREE_ECONOMY) {
    breakdown.ruleType = PricingRuleTypeValues.FREE;
    return breakdown;
  }

  const freeRule = listing.pricingRules?.find(
    (rule) => rule.type === PricingRuleTypeValues.FREE,
  );

  if (freeRule !== undefined) {
    breakdown.ruleType = PricingRuleTypeValues.FREE;
    return breakdown;
  }

  const decayRule = listing.pricingRules?.find(
    (rule) => rule.type === PricingRuleTypeValues.DECAY,
  );

  if (
    flags.ENABLE_PRICE_DECAY &&
    decayRule !== undefined &&
    isPriceDecaySchedule(decayRule.decaySchedule)
  ) {
    const decay = evaluatePriceDecay(decayRule.decaySchedule, options.now);
    breakdown.ruleType = PricingRuleTypeValues.DECAY;
    breakdown.decay = decay;
  }

  return breakdown;
}