import type { ExplanationTree } from "@bluewave/events";
import type {
  AccelerationPreview,
  ConstructionSteeringPreview,
  HaltPreview,
} from "@bluewave/phase-engine";

const tree = (formulaId: string, result: number): ExplanationTree => ({
  formulaId,
  formulaVersion: "construction_steering_v1",
  inputs: { amount: result },
  intermediate: {},
  result,
  unit: "units",
});

export const accelerationPreview = (
  over: Partial<AccelerationPreview> = {},
): AccelerationPreview => ({
  monthsNow: 10,
  monthsAccelerated: 7,
  monthsSaved: 3,
  launchMonthNow: "1880-11",
  launchMonthAccelerated: "1880-08",
  premiumUnits: 1_200,
  premiumRateBp: 500,
  delayRisk: "POSSIBLE",
  delayChanceBp: 1_500,
  fundsLimited: false,
  monthsExplanation: tree("construction_acceleration_months", 3),
  premiumExplanation: tree("construction_acceleration_premium", 1_200),
  delayExplanation: tree("construction_acceleration_delay", 1_500),
  ...over,
});

export const haltPreview = (over: Partial<HaltPreview> = {}): HaltPreview => ({
  carryingCostUnits: 80,
  resumeStatus: "ACTIVE",
  losesAcceleration: false,
  carryingExplanation: tree("construction_halt_carrying", 80),
  ...over,
});

export const steeringPreview = (
  over: Partial<ConstructionSteeringPreview> = {},
): ConstructionSteeringPreview => ({
  accelerate: accelerationPreview(),
  halt: haltPreview(),
  ...over,
});
