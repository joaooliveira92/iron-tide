export const AIR_COMBAT_RULESET_VERSION = "1" as const;

export const AIR_COMBAT_SPEED_MPS_FACTOR = 250 as const;
export const AIR_COMBAT_SPEED_MPS_BASE = 20 as const;
export const AIR_COMBAT_SPEED_SCORE_MULTIPLIER_BP = 25_000 as const;
export const AIR_COMBAT_SPEED_SCORE_DENOMINATOR_BP = 10_000 as const;
export const AIR_COMBAT_MIN_SPEED_MPS = 20 as const;
export const AIR_COMBAT_SPEED_SCORE_MULTIPLIER = 5 as const;

export const AIR_COMBAT_SENSOR_RANGE_MULTIPLIER = 1_000 as const;

export const AIR_COMBAT_BASIS_POINTS_PER_UNIT = 10_000 as const;

export const CAP_ENGAGEMENT_STATES = [
  "PATROLLING",
  "INTERCEPTING",
  "ENGAGING",
  "RETURNING",
] as const;
export type CapEngagementState = (typeof CAP_ENGAGEMENT_STATES)[number];

export const CAP_PATROL_ALTITUDES = ["HIGH", "MEDIUM", "LOW"] as const;
export type CapPatrolAltitude = (typeof CAP_PATROL_ALTITUDES)[number];

export const CAP_DEFAULT_PATROL_ALTITUDE = "MEDIUM" as const satisfies CapPatrolAltitude;

export type DetectionOutcome = "DETECTED" | "UNDETECTED" | "TOO_LATE";

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

export const AIR_COMBAT_EXCHANGE_FACTOR_KEYS = [
  "quality",
  "numericalAdvantage",
  "altitude",
  "surprise",
  "defenderSurvival",
  "escort",
] as const;

export type AirCombatExchangeFactorKey = (typeof AIR_COMBAT_EXCHANGE_FACTOR_KEYS)[number];

export type ExchangeSideDesignation = "ATTACKER" | "DEFENDER";

export const AIR_COMBAT_LEVEL_BOMBING_BASE_ACCURACY_BP = 10_000 as const;

export const AIR_COMBAT_DIVE_BOMBING_BASE_ACCURACY_BP = 22_500 as const;

export const AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP = 8_500 as const;

export const AIR_COMBAT_VISIBILITY_CLEAR_BP = 10_000 as const;
export const AIR_COMBAT_VISIBILITY_HAZY_BP = 8_000 as const;
export const AIR_COMBAT_VISIBILITY_FOG_BP = 5_000 as const;
export const AIR_COMBAT_VISIBILITY_NIGHT_BP = 3_000 as const;

export const AIR_COMBAT_MANEUVER_STATIONARY_BP = 10_000 as const;
export const AIR_COMBAT_MANEUVER_LARGE_BP = 9_000 as const;
export const AIR_COMBAT_MANEUVER_MEDIUM_BP = 7_500 as const;
export const AIR_COMBAT_MANEUVER_SMALL_BP = 5_000 as const;
export const AIR_COMBAT_MANEUVER_AGILE_BP = 3_000 as const;

export const AIR_COMBAT_BOMBING_ALTITUDE_HIGH_BP = 5_000 as const;
export const AIR_COMBAT_BOMBING_ALTITUDE_MEDIUM_BP = 8_500 as const;
export const AIR_COMBAT_BOMBING_ALTITUDE_LOW_BP = 10_000 as const;

export const AIR_COMBAT_PAYLOAD_FACTOR_MULTIPLIER = 50 as const;

export const AIR_COMBAT_PAYLOAD_FACTOR_MIN_BP = 1_000 as const;
export const AIR_COMBAT_PAYLOAD_FACTOR_MAX_BP = 10_000 as const;

export const AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP = 10_000 as const;

export const AIR_COMBAT_TORPEDO_MIN_DROP_SPEED_MPS = 50 as const;
export const AIR_COMBAT_TORPEDO_MIN_DROP_ALTITUDE_M = 10 as const;
export const AIR_COMBAT_TORPEDO_MAX_DROP_ALTITUDE_M = 300 as const;
export const AIR_COMBAT_TORPEDO_MIN_RUN_M = 200 as const;
export const AIR_COMBAT_TORPEDO_AIR_LAUNCH_HIT_BONUS_BP = 12_500 as const;
export const AIR_COMBAT_TORPEDO_BASE_HIT_BP = 5_000 as const;
export const AIR_COMBAT_BOMB_BASE_STRUCTURAL_DAMAGE = 100 as const;
export const AIR_COMBAT_BOMB_BASE_FLOTATION_DAMAGE = 50 as const;
export const AIR_COMBAT_TORPEDO_STRUCTURAL_DAMAGE = 500 as const;
export const AIR_COMBAT_TORPEDO_FLOTATION_DAMAGE = 1000 as const;
