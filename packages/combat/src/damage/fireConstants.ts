// DESIGN-41 §20-25 — Per-minute fire resolution constants.
// Fire-risk multipliers extend those in immediateFireFlooding.ts (§20).
// All numeric values are integer basis points unless otherwise noted.

export const firePolicyId = "fire_resolution_v1" as const;
export const FIRE_RESOLUTION_RULESET_VERSION = "fire_resolution_ruleset_v1" as const;
export const FIRE_RESOLUTION_FORMULA_VERSION = "fire_resolution_formula_v1" as const;

// Fire-risk multipliers by ship type (DESIGN-41 §20) — extends existing ones
// in immediateFireFlooding.ts. These represent the base probability that a
// qualified hit starts a fire. 10_000 bp = 100% probability.
export const FIRE_RISK_MULTIPLIERS: Record<string, number> = {
  ORDINARY: 10_000,
  CARRIER: 15_000,
  TRANSPORT: 13_000,
  AMC: 12_500,
  AV: 13_000,
  PRE_DREADNOUGHT: 12_000,
};

// Rate-of-fire penalty bands by fire intensity (DESIGN-41 §22).
// Multiplier is in basis points [0, 10_000]; applied to the ship's rate-of-fire.
// Higher intensity = lower multiplier = worse penalty.
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

// Fire night visibility bands (DESIGN-41 §24).
// Higher intensity = greater visibility multiplier = easier to spot.
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

// Fire smoke fuel multipliers (DESIGN-41 §25).
// Higher = more smoke produced for a given fire intensity.
export const FIRE_SMOKE_FUEL_MULTIPLIERS: Record<string, number> = {
  ORDINARY: 8_000,
  OIL: 12_000,
  COAL: 15_000,
  MIXED: 10_000,
};

// Default ventilation multiplier (bp) when no custom value is provided.
export const FIRE_DEFAULT_VENTILATION_MULTIPLIER_BP = 10_000;

// Default fuel-class multiplier (bp) for unknown fuel types.
export const FIRE_DEFAULT_FUEL_MULTIPLIER_BP = 8_000;

// Fire suppression base rate (bp per minute).
export const FIRE_SUPPRESSION_BASE_RATE_BP = 500;

// Fire spread base probability (bp).
export const FIRE_SPREAD_BASE_PROBABILITY_BP = 1_000;

// Default fire intensity decay per minute when suppressed.
export const FIRE_INTENSITY_DECAY_PER_MINUTE = 200;

// Base intensity for a fire created by spread from another fire.
export const FIRE_SPREAD_BASE_INTENSITY_BP = 3_000;
