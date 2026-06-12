import type { Coordinates, OrderInput, RoutingCandidate, ShopCapability } from "@tpt/types";
import type { RoutingWeights } from "./weights";

const EARTH_RADIUS_KM = 6371;
const GEO_NORMALIZATION_DISTANCE_KM = 100;
const CAPACITY_NORMALIZATION_UNITS = 10;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toCoordinates(
  value: Coordinates | { lat?: number; lng?: number } | undefined,
): Coordinates | undefined {
  if (
    value === undefined ||
    typeof value.lat !== "number" ||
    typeof value.lng !== "number" ||
    !Number.isFinite(value.lat) ||
    !Number.isFinite(value.lng)
  ) {
    return undefined;
  }

  return { lat: value.lat, lng: value.lng };
}

export function distanceKm(
  origin: Coordinates | { lat?: number; lng?: number } | undefined,
  destination: Coordinates | { lat?: number; lng?: number } | undefined,
): number {
  const from = toCoordinates(origin);
  const to = toCoordinates(destination);

  if (from === undefined || to === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function scoreGeo(
  order: OrderInput,
  candidate: RoutingCandidate,
): number {
  const distance = distanceKm(order.deliveryAddress, candidate.location);

  if (!Number.isFinite(distance)) {
    return 0.5;
  }

  return clamp(1 - distance / GEO_NORMALIZATION_DISTANCE_KM, 0, 1);
}

export function scoreCost(
  candidate: RoutingCandidate,
  maxCost?: number,
): number {
  const costEstimate = candidate.costEstimate;

  if (
    typeof costEstimate !== "number" ||
    !Number.isFinite(costEstimate) ||
    costEstimate < 0
  ) {
    return 0.5;
  }

  if (costEstimate === 0) {
    return 1;
  }

  if (
    typeof maxCost === "number" &&
    Number.isFinite(maxCost) &&
    maxCost > 0
  ) {
    return clamp(1 - costEstimate / maxCost, 0, 1);
  }

  return clamp(1 - costEstimate / (costEstimate + 1), 0, 1);
}

export function scoreCapacity(candidate: RoutingCandidate): number {
  const capacity = candidate.capacity;

  if (typeof capacity !== "number" || !Number.isFinite(capacity)) {
    return 0.5;
  }

  if (capacity <= 0) {
    return 0;
  }

  return clamp(capacity / CAPACITY_NORMALIZATION_UNITS, 0, 1);
}

function capabilityMatches(
  capability: ShopCapability,
  requirement: RequiredCapability,
): boolean {
  if (
    requirement.material !== undefined &&
    capability.material !== requirement.material
  ) {
    return false;
  }

  if (
    requirement.machineType !== undefined &&
    capability.machineType !== requirement.machineType
  ) {
    return false;
  }

  if (
    requirement.category !== undefined &&
    capability.category !== requirement.category
  ) {
    return false;
  }

  return true;
}

interface RequiredCapability {
  material?: string;
  machineType?: string;
  category?: string;
}

function requiredCapabilities(order: OrderInput): RequiredCapability[] {
  return order.items.flatMap((item) => {
    const requirement: RequiredCapability = {};

    if (item.material !== undefined) {
      requirement.material = item.material;
    }

    if (item.machineType !== undefined) {
      requirement.machineType = item.machineType;
    }

    if (item.category !== undefined) {
      requirement.category = item.category;
    }

    return Object.keys(requirement).length > 0 ? [requirement] : [];
  });
}

export function scoreCapability(
  order: OrderInput,
  candidate: RoutingCandidate,
): number {
  const requirements = requiredCapabilities(order);
  const capabilities = candidate.capabilities ?? [];

  if (requirements.length === 0) {
    return 0.5;
  }

  if (capabilities.length === 0) {
    return 0;
  }

  const matchedRequirements = requirements.filter((requirement) =>
    capabilities.some((capability) =>
      capabilityMatches(capability, requirement),
    ),
  );

  return matchedRequirements.length / requirements.length;
}

export function calculateTotalScore(
  scores: {
    geoScore: number;
    costScore: number;
    capacityScore: number;
    capabilityScore: number;
  },
  weights: RoutingWeights,
): number {
  return clamp(
    scores.geoScore * weights.geo +
      scores.costScore * weights.cost +
      scores.capacityScore * weights.capacity +
      scores.capabilityScore * weights.capability,
    0,
    1,
  );
}