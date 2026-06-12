import type {
  PriceDecayCurve,
  PriceDecaySchedule,
  PriceDecayStep,
} from "@tpt/types";
import { clamp } from "../routing/scorer";

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function interpolateLinear(
  startPrice: number,
  endPrice: number,
  progress: number,
): number {
  return startPrice + (endPrice - startPrice) * progress;
}

function interpolateExponential(
  startPrice: number,
  endPrice: number,
  progress: number,
): number {
  const curveStrength = 4;
  const easedProgress =
    (1 - Math.exp(-curveStrength * progress)) /
    (1 - Math.exp(-curveStrength));

  return startPrice + (endPrice - startPrice) * easedProgress;
}

function resolveStepPrice(
  steps: PriceDecayStep[],
  progress: number,
  fallbackPrice: number,
): number {
  const sortedSteps = [...steps].sort((left, right) => left.at - right.at);
  let selectedStep: PriceDecayStep | undefined = sortedSteps[0];

  for (let index = sortedSteps.length - 1; index >= 0; index -= 1) {
    const step = sortedSteps[index];

    if (step !== undefined && progress >= step.at) {
      selectedStep = step;
      break;
    }
  }

  return selectedStep?.price ?? fallbackPrice;
}

export function evaluatePriceDecay(
  schedule: PriceDecaySchedule,
  now = new Date(),
): {
  price: number;
  progress: number;
  curve: PriceDecayCurve;
} {
  const startDate = toDate(schedule.startDate);
  const endDate = toDate(schedule.endDate);
  const curve = schedule.curve ?? "linear";

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    return {
      price: Math.max(0, schedule.endPrice),
      progress: 1,
      curve,
    };
  }

  if (now <= startDate) {
    return {
      price: Math.max(0, schedule.startPrice),
      progress: 0,
      curve,
    };
  }

  if (now >= endDate) {
    return {
      price: Math.max(0, schedule.endPrice),
      progress: 1,
      curve,
    };
  }

  const progress = clamp(
    (now.getTime() - startDate.getTime()) /
      (endDate.getTime() - startDate.getTime()),
    0,
    1,
  );
  const linearPrice = interpolateLinear(
    schedule.startPrice,
    schedule.endPrice,
    progress,
  );
  const price =
    curve === "step" && schedule.steps !== undefined
      ? resolveStepPrice(schedule.steps, progress, linearPrice)
      : curve === "exponential"
        ? interpolateExponential(
            schedule.startPrice,
            schedule.endPrice,
            progress,
          )
        : linearPrice;

  return {
    price: Math.max(0, price),
    progress,
    curve,
  };
}