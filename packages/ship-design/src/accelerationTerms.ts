import type { ConstructionBalance } from "./construction.js";
import type { CostBalance } from "./cost.js";

const BP = 10_000;

export interface AccelerationTerms {
  readonly workMultiplierBp: number;
  readonly timeBp: number;
  readonly pressureWeightBp: number;
  readonly delayThresholdBp: number;
  readonly delayProbabilityCapBp: number;
  readonly poolMultipleBp: number;
}

export function accelerationTermsOf(
  construction: ConstructionBalance,
  cost: Pick<CostBalance, "accelerationCostBp">,
): AccelerationTerms {
  return {
    workMultiplierBp: BP + cost.accelerationCostBp,
    timeBp: construction.accelerationTimeBp,
    pressureWeightBp: construction.accelerationPressureWeightBp,
    delayThresholdBp: construction.accelerationDelayThresholdBp,
    delayProbabilityCapBp: construction.accelerationDelayProbabilityCapBp,
    poolMultipleBp: construction.accelerationPoolMultipleBp,
  };
}

export function acceleratedWorkRate(unitsPerMonth: number, terms: AccelerationTerms): number {
  return Math.floor((unitsPerMonth * terms.workMultiplierBp) / terms.timeBp);
}
