// DESIGN-41 §§13-18 — Per-minute flooding resolution constants.
// Integer fixed-point arithmetic only; no floating point for authoritative values.
// Versioned policy and formula identifiers for contract validation.

export const floodingPolicyId = "flooding_resolution_v1" as const;
export const FLOODING_RESOLUTION_RULESET_VERSION = "flooding_resolution_ruleset_v1" as const;
export const FLOODING_RESOLUTION_FORMULA_VERSION = "flooding_resolution_formula_v1" as const;

// ---- Flooding severity thresholds (DESIGN-41 §14) ----
// Values are in basis points of ship displacement.
export const FLOODING_SEVERITY_THRESHOLDS = {
  MINOR_MAX: 499, // 0..499 bp
  SERIOUS_MAX: 1_499, // 500..1_499
  MAJOR_MAX: 2_999, // 1_500..2_999
  // CRITICAL: >= 3_000 bp (implied)
} as const;

// ---- Flooding speed effects — max speed multiplier per severity (DESIGN-41 §15) ----
// Multiplier in basis points applied to maximum speed.
export const FLOODING_SPEED_MULTIPLIERS: Record<string, number> = {
  MINOR: 9_500,
  SERIOUS: 8_000,
  MAJOR: 6_000,
  CRITICAL: 3_500,
};

// ---- Flooding stability multiplier per severity (DESIGN-41 §15) ----
// Multiplier in basis points applied to stability score.
export const FLOODING_STABILITY_MULTIPLIERS: Record<string, number> = {
  MINOR: 9_500,
  SERIOUS: 8_500,
  MAJOR: 7_000,
  CRITICAL: 5_000,
};

// ---- Speed-pressure multiplier bands (DESIGN-41 §16) ----
// Speed in knots: ≤10, >10-≤15, >15-≤20, >20-≤25, >25
// Each entry is [maxSpeedKt inclusive, multiplierBp] — the last band
// uses Infinity so it matches any remaining speed.
// Multiplier in basis points applied to ingress rate.
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

// ---- High-speed loss base probability (DESIGN-41 §17) ----
// Format: severity -> speedBand -> probability in basis points.
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

// ---- Control speed threshold (10 knots = 5_144_440 µm/s) ----
// Speed below which pumping/repair can fully counteract flooding.
export const CONTROL_SPEED_THRESHOLD_KT = 10;

// ---- Base pumping rate (kg/min per allocated pump unit) ----
export const BASE_PUMPING_RATE_KG_MIN = 200;

// ---- Base repair reduction (kg/min per allocated repair unit) ----
export const BASE_REPAIR_REDUCTION_KG_MIN = 100;

// ---- Dewatering rate when pumping > ingress (kg/min) ----
export const DEWATERING_RATE_KG_MIN = 100;
