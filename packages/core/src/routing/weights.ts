import type { ProcessEnv } from "../flags";

export type RoutingWeightKey = "geo" | "cost" | "capacity" | "capability";

export interface RoutingWeights {
  geo: number;
  cost: number;
  capacity: number;
  capability: number;
}

export const DEFAULT_ROUTING_WEIGHTS: RoutingWeights = {
  geo: 0.35,
  cost: 0.25,
  capacity: 0.25,
  capability: 0.15,
};

const ROUTING_WEIGHT_ENV_KEYS = {
  geo: "ROUTING_WEIGHT_GEO",
  cost: "ROUTING_WEIGHT_COST",
  capacity: "ROUTING_WEIGHT_CAPACITY",
  capability: "ROUTING_WEIGHT_CAPABILITY",
} as const satisfies Record<RoutingWeightKey, string>;

export function parseEnvNumber(
  value: string | undefined,
  defaultValue: number,
): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function normalizeWeights(weights: RoutingWeights): RoutingWeights {
  const geo = Math.max(0, weights.geo);
  const cost = Math.max(0, weights.cost);
  const capacity = Math.max(0, weights.capacity);
  const capability = Math.max(0, weights.capability);
  const total = geo + cost + capacity + capability;

  if (total <= 0) {
    return { ...DEFAULT_ROUTING_WEIGHTS };
  }

  return {
    geo: geo / total,
    cost: cost / total,
    capacity: capacity / total,
    capability: capability / total,
  };
}

export function resolveRoutingWeights(
  env: ProcessEnv = {},
): RoutingWeights {
  const overrides: Partial<Record<RoutingWeightKey, number>> = {};

  for (const key of Object.keys(
    ROUTING_WEIGHT_ENV_KEYS,
  ) as RoutingWeightKey[]) {
    const rawValue = env[ROUTING_WEIGHT_ENV_KEYS[key]];

    if (rawValue !== undefined && rawValue.trim() !== "") {
      overrides[key] = parseEnvNumber(
        rawValue,
        DEFAULT_ROUTING_WEIGHTS[key],
      );
    }
  }

  return normalizeWeights({ ...DEFAULT_ROUTING_WEIGHTS, ...overrides });
}

export const routingWeights = resolveRoutingWeights();