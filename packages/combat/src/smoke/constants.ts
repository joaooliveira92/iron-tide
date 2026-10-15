// DESIGN-42 §8, §11 smoke constants per the C-5 spec.
// Policy identifiers
export const smokePolicyId = "smoke_v1" as const;
export const SMOKE_RULESET_VERSION = "smoke_ruleset_v1" as const;
export const SMOKE_FORMULA_VERSION = "smoke_formula_v1" as const;

// Smoke source types (§5)
export const SMOKE_SOURCE_TYPES = ["FUNNEL", "SMOKESCREEN", "FLOAT", "GENERATOR", "FIRE"] as const;
export type SmokeSourceType = (typeof SMOKE_SOURCE_TYPES)[number];

// Wind retention multipliers (§8)
export const WIND_RETENTION_LT_5_BP = 9_500 as const;
export const WIND_RETENTION_5_TO_15_BP = 9_000 as const;
export const WIND_RETENTION_15_TO_25_BP = 8_000 as const;
export const WIND_RETENTION_GE_25_BP = 6_500 as const;

// Funnel smoke fuel multipliers (§11)
export const FUNNEL_FUEL_MULTIPLIERS: Record<string, number> = {
  coal: 15_000,
  mixed: 12_500,
  oil: 7_500,
  nuclear: 0,
} as const;

// Funnel smoke power-setting multipliers (§11)
export const FUNNEL_POWER_MULTIPLIERS: {
  readonly minBp: number;
  readonly maxBp: number;
  readonly multiplier: number;
}[] = [
  { minBp: 0, maxBp: 4_999, multiplier: 5_000 },
  { minBp: 5_000, maxBp: 7_499, multiplier: 10_000 },
  { minBp: 7_500, maxBp: 9_499, multiplier: 12_500 },
  { minBp: 9_500, maxBp: 10_000, multiplier: 15_000 },
] as const;

// Reference path length
export const SMOKE_REFERENCE_PATH_LENGTH = 1_000 as const;

// Optical multiplier constants
export const SMOKE_OPTICAL_NUMERATOR = 8_000 as const;
export const SMOKE_OPTICAL_DENOMINATOR = 10_000 as const;
export const SMOKE_OPTICAL_MIN = 1_000 as const;

// Funnel smoke base density
export const FUNNEL_SMOKE_BASE_DENSITY = 5_000 as const;

// Smokescreen constants
export const SMOKESCREEN_INITIAL_DENSITY = 9_000 as const;
export const SMOKESCREEN_REFERENCE_WIDTH_M = 500 as const;
export const SMOKESCREEN_VERTICAL_EXTENT_M = 100 as const;
export const SMOKESCREEN_GENERATION_DURATION_MINUTES = 5 as const;
export const SMOKESCREEN_COOLDOWN_MINUTES = 20 as const;

// Smoke float constants
export const SMOKE_FLOAT_CAPACITY = 4 as const;
export const SMOKE_FLOAT_INITIAL_DENSITY = 8_500 as const;
export const SMOKE_FLOAT_REFERENCE_WIDTH_M = 400 as const;
export const SMOKE_FLOAT_EMISSION_DURATION_MINUTES = 5 as const;
export const SMOKE_FLOAT_MAX_DEPLOYMENT_SPEED_KT = 25 as const;

// Smoke generator constants
export const SMOKE_GENERATOR_DURATION_MINUTES = 5 as const;
export const SMOKE_GENERATOR_COOLDOWN_MINUTES = 20 as const;
export const SMOKE_GENERATOR_CHARGES = 3 as const;
export const SMOKE_GENERATOR_INITIAL_DENSITY = 9_000 as const;
export const SMOKE_GENERATOR_REFERENCE_WIDTH_M = 500 as const;

// Doctrine adoption
export const SMOKE_DOCTRINE_ADOPTION_MONTHS = 3 as const;
