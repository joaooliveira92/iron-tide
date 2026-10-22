export const firePolicyId = "fire_resolution_v1" as const;
export const FIRE_RESOLUTION_RULESET_VERSION = "fire_resolution_ruleset_v1" as const;
export const FIRE_RESOLUTION_FORMULA_VERSION = "fire_resolution_formula_v1" as const;

export const FIRE_RISK_MULTIPLIERS: Record<string, number> = {
  ORDINARY: 10_000,
  CARRIER: 15_000,
  TRANSPORT: 13_000,
  AMC: 12_500,
  AV: 13_000,
  PRE_DREADNOUGHT: 12_000,
};

export const FIRE_ROF_PENALTY_BANDS: Array<{
  minIntensity: number;
  maxIntensity: number;
  multiplierBp: number;
}> = [
  { minIntensity: 1, maxIntensity: 2_499, multiplierBp: 9_500 },
  { minIntensity: 2_500, maxIntensity: 4_999, multiplierBp: 8_500 },
  { minIntensity: 5_000, maxIntensity: 7_499, multiplierBp: 7_000 },
  { minIntensity: 7_500, maxIntensity: 10_000, multiplierBp: 5_000 },
];

export const FIRE_NIGHT_SIGNATURE_BANDS: Array<{
  minIntensity: number;
  maxIntensity: number;
  multiplierBp: number;
}> = [
  { minIntensity: 0, maxIntensity: 999, multiplierBp: 10_000 },
  { minIntensity: 1_000, maxIntensity: 2_499, multiplierBp: 12_500 },
  { minIntensity: 2_500, maxIntensity: 4_999, multiplierBp: 15_000 },
  { minIntensity: 5_000, maxIntensity: 7_499, multiplierBp: 20_000 },
  { minIntensity: 7_500, maxIntensity: 10_000, multiplierBp: 30_000 },
];

export const FIRE_SMOKE_FUEL_MULTIPLIERS: Record<string, number> = {
  ORDINARY: 8_000,
  OIL: 12_000,
  COAL: 15_000,
  MIXED: 10_000,
};

export const FIRE_DEFAULT_VENTILATION_MULTIPLIER_BP = 10_000;

export const FIRE_DEFAULT_FUEL_MULTIPLIER_BP = 8_000;

export const FIRE_SUPPRESSION_BASE_RATE_BP = 500;

export const FIRE_SPREAD_BASE_PROBABILITY_BP = 1_000;

export const FIRE_INTENSITY_DECAY_PER_MINUTE = 200;

export const FIRE_SPREAD_BASE_INTENSITY_BP = 3_000;
