export const floodingPolicyId = "flooding_resolution_v1" as const;
export const FLOODING_RESOLUTION_RULESET_VERSION = "flooding_resolution_ruleset_v1" as const;
export const FLOODING_RESOLUTION_FORMULA_VERSION = "flooding_resolution_formula_v1" as const;

export const FLOODING_SEVERITY_THRESHOLDS = {
  MINOR_MAX: 499,
  SERIOUS_MAX: 1_499,
  MAJOR_MAX: 2_999,
} as const;

export const FLOODING_SPEED_MULTIPLIERS: Record<string, number> = {
  MINOR: 9_500,
  SERIOUS: 8_000,
  MAJOR: 6_000,
  CRITICAL: 3_500,
};

export const FLOODING_STABILITY_MULTIPLIERS: Record<string, number> = {
  MINOR: 9_500,
  SERIOUS: 8_500,
  MAJOR: 7_000,
  CRITICAL: 5_000,
};

export const SPEED_PRESSURE_MULTIPLIERS: Array<{
  maxSpeedKt: number;
  multiplierBp: number;
}> = [
  { maxSpeedKt: 10, multiplierBp: 7_500 },
  { maxSpeedKt: 15, multiplierBp: 10_000 },
  { maxSpeedKt: 20, multiplierBp: 12_500 },
  { maxSpeedKt: 25, multiplierBp: 15_000 },
  { maxSpeedKt: Infinity, multiplierBp: 20_000 },
];

export const HIGH_SPEED_LOSS_PROBABILITY: Record<string, Record<string, number>> = {
  MAJOR: {
    "20-25": 500,
    OVER_25: 1_500,
  },
  CRITICAL: {
    "20-25": 2_000,
    OVER_25: 5_000,
  },
};

export const CONTROL_SPEED_THRESHOLD_KT = 10;

export const BASE_PUMPING_RATE_KG_MIN = 200;

export const BASE_REPAIR_REDUCTION_KG_MIN = 100;

export const DEWATERING_RATE_KG_MIN = 100;
