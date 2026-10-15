// D-3 M4 Aviation: CAP & Strikes — INC-1, INC-2 & INC-4 versioned constants.
// Parallel to aircraft/constants.ts, carrier-operations/constants.ts.

// ---- INC-1 constants ----

export const AIR_COMBAT_RULESET_VERSION = "1" as const;

// Speed score → m/s conversion: mps = speed * 2.5 + 20
// Stored as bp: speed * 250 + 2000, then floor / 100
export const AIR_COMBAT_SPEED_MPS_FACTOR = 250 as const; // 2.5 in bp (250bp per 0.01)
export const AIR_COMBAT_SPEED_MPS_BASE = 20 as const; // intercept in m/s
export const AIR_COMBAT_SPEED_SCORE_MULTIPLIER_BP = 25_000 as const;
export const AIR_COMBAT_SPEED_SCORE_DENOMINATOR_BP = 10_000 as const;
export const AIR_COMBAT_MIN_SPEED_MPS = 20 as const;
export const AIR_COMBAT_SPEED_SCORE_MULTIPLIER = 5 as const;

// Detection: capSensorValue * 1000 = detection range in meters
export const AIR_COMBAT_SENSOR_RANGE_MULTIPLIER = 1_000 as const;

// Basis points per unit (shared convention)
export const AIR_COMBAT_BASIS_POINTS_PER_UNIT = 10_000 as const;

// Engagement state — combat lifecycle for a CAP patrol
export const CAP_ENGAGEMENT_STATES = [
  "PATROLLING",
  "INTERCEPTING",
  "ENGAGING",
  "RETURNING",
] as const;
export type CapEngagementState = (typeof CAP_ENGAGEMENT_STATES)[number];

// Patrol altitude bands
export const CAP_PATROL_ALTITUDES = ["HIGH", "MEDIUM", "LOW"] as const;
export type CapPatrolAltitude = (typeof CAP_PATROL_ALTITUDES)[number];

// Default patrol altitude
export const CAP_DEFAULT_PATROL_ALTITUDE = "MEDIUM" as const satisfies CapPatrolAltitude;

// Detection outcome
export type DetectionOutcome = "DETECTED" | "UNDETECTED" | "TOO_LATE";

// ---- INC-2 constants (exchange formula) ----

export const AIR_COMBAT_FORMULA_VERSION = "air_combat_formula_v1" as const;

export const AIR_COMBAT_BASIS_POINTS = 10_000 as const;
export const AIR_COMBAT_QUALITY_MIN_BP = 0 as const;
export const AIR_COMBAT_QUALITY_MAX_BP = 10_000 as const;
export const AIR_COMBAT_NUMERICAL_MIN_BP = 500 as const;
export const AIR_COMBAT_NEUTRAL_MULTIPLIER_BP = 10_000 as const;
export const AIR_COMBAT_ALTITUDE_NEUTRAL_BP = 10_000 as const;
export const AIR_COMBAT_ALTITUDE_ADVANTAGE_BP = 12_500 as const;
export const AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP = 8_500 as const;
export const AIR_COMBAT_SURPRISE_FIRST_PASS_BP = 12_500 as const;
export const AIR_COMBAT_SURPRISE_SUBSEQUENT_BP = 10_000 as const;
export const AIR_COMBAT_DISRUPTION_MIN_BP = 5_000 as const;
export const AIR_COMBAT_ENGAGEMENT_SUBSTEP = 1 as const;
export const AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP = 5_000 as const;
export const AIR_COMBAT_RULESET_VERSION_EXCHANGE = "air_combat_ruleset_v1" as const;

// 6-factor manifest for air-to-air exchange formula
export const AIR_COMBAT_EXCHANGE_FACTOR_KEYS = [
  "quality",
  "numericalAdvantage",
  "altitude",
  "surprise",
  "defenderSurvival",
  "escort",
] as const;

export type AirCombatExchangeFactorKey = (typeof AIR_COMBAT_EXCHANGE_FACTOR_KEYS)[number];

// Side designation for exchanges
export type ExchangeSideDesignation = "ATTACKER" | "DEFENDER";

// ---- INC-4 constants (bombing) ----

// Level bombing baseline accuracy (bp)
export const AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP = 10_000 as const;

// Dive bombing accuracy bonus (bp)
export const AIR_COMBAT_DIVE_BOMBING_BASE_ACCURACY_BP = 22_500 as const;

// Dive bombing penetration multiplier (bp) — 8_500bp = 0.85x
export const AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP = 8_500 as const;

// Visibility penalty: poor visibility reduces accuracy
export const AIR_COMBAT_VISIBILITY_CLEAR_BP = 10_000 as const;
export const AIR_COMBAT_VISIBILITY_HAZY_BP = 8_000 as const;
export const AIR_COMBAT_VISIBILITY_FOG_BP = 5_000 as const;
export const AIR_COMBAT_VISIBILITY_NIGHT_BP = 3_000 as const;

// Target maneuver reduction: stationary/large target = 10_000 (no penalty), small/agile = lower
export const AIR_COMBAT_MANEUVER_STATIONARY_BP = 10_000 as const;
export const AIR_COMBAT_MANEUVER_LARGE_BP = 9_000 as const;
export const AIR_COMBAT_MANEUVER_MEDIUM_BP = 7_500 as const;
export const AIR_COMBAT_MANEUVER_SMALL_BP = 5_000 as const;
export const AIR_COMBAT_MANEUVER_AGILE_BP = 3_000 as const;

// Altitude penalty for bombing (higher = worse for level bombing)
export const AIR_COMBAT_BOMBING_ALTITUDE_HIGH_BP = 5_000 as const;
export const AIR_COMBAT_BOMBING_ALTITUDE_MEDIUM_BP = 8_500 as const;
export const AIR_COMBAT_BOMBING_ALTITUDE_LOW_BP = 10_000 as const;

// Payload factor multiplier: 50bp per payload point
export const AIR_COMBAT_PAYLOAD_FACTOR_MULTIPLIER = 50 as const;

// Payload factor clamp bounds
export const AIR_COMBAT_PAYLOAD_FACTOR_MIN_BP = 1_000 as const;
export const AIR_COMBAT_PAYLOAD_FACTOR_MAX_BP = 10_000 as const;

// Level bombing penetration multiplier (baseline — no change)
export const AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP = 10_000 as const;

// ---- INC-5 constants (air-launched torpedo) ----

export const AIR_COMBAT_TORPEDO_MIN_DROP_SPEED_MPS = 50 as const; // minimum speed for safe drop
export const AIR_COMBAT_TORPEDO_MIN_DROP_ALTITUDE_M = 10 as const; // minimum altitude for drop
export const AIR_COMBAT_TORPEDO_MAX_DROP_ALTITUDE_M = 300 as const; // max altitude for accurate drop
export const AIR_COMBAT_TORPEDO_MIN_RUN_M = 200 as const; // minimum run distance
export const AIR_COMBAT_TORPEDO_AIR_LAUNCH_HIT_BONUS_BP = 12_500 as const; // closing speed bonus
export const AIR_COMBAT_TORPEDO_BASE_HIT_BP = 5_000 as const; // base hit probability
export const AIR_COMBAT_BOMB_BASE_STRUCTURAL_DAMAGE = 100 as const; // base bomb structural damage
export const AIR_COMBAT_BOMB_BASE_FLOTATION_DAMAGE = 50 as const; // base bomb flotation damage
export const AIR_COMBAT_TORPEDO_STRUCTURAL_DAMAGE = 500 as const; // torpedo vs ship structural
export const AIR_COMBAT_TORPEDO_FLOTATION_DAMAGE = 1000 as const; // torpedo flotation damage
