import { BluewaveError, SafeInt } from "@bluewave/contracts";

export const NAUTICAL_MILE_M = 1_852 as const;
export const HEAVY_AA_PROTECTED_RADIUS_NM = 5 as const;
export const HEAVY_AA_PROTECTED_RADIUS_M = 9_260 as const;

export const MEDIUM_AA_FIRE_CONTROL_MINIMUM_BP = 4_000 as const;

export const DIRECTOR_SCALING_TABLE = [
  [0, 5_000],
  [1, 10_000],
  [2, 18_000],
  [3, 25_000],
  [4, 31_000],
] as const;

export const RADAR_SATURATION_TABLE = [
  [1, 10_000],
  [2, 10_000],
  [3, 10_000],
  [4, 10_000],
  [5, 5_000],
  [6, 5_000],
  [7, 2_500],
  [8, 2_500],
  [9, 500],
] as const;

export function radarMediumAaMarginalMultiplierBp(groupCount: number): number {
  if (groupCount < 1) return 0;
  const last = RADAR_SATURATION_TABLE[RADAR_SATURATION_TABLE.length - 1];
  if (last === undefined) return 0;
  return groupCount <= last[0] ? (RADAR_SATURATION_TABLE[groupCount - 1]?.[1] ?? 0) : last[1];
}

export const CIWS_REDUNDANCY_TABLE = [
  [1, 10_000],
  [2, 10_000],
  [3, 10_000],
  [4, 10_000],
  [5, 5_000],
  [6, 5_000],
  [7, 1_500],
  [8, 1_500],
  [9, 500],
] as const;

export function ciwsMarginalMultiplierBp(systemCount: number): number {
  if (systemCount < 1) return 0;
  const last = CIWS_REDUNDANCY_TABLE[CIWS_REDUNDANCY_TABLE.length - 1];
  if (last === undefined) return 0;
  return systemCount <= last[0] ? (CIWS_REDUNDANCY_TABLE[systemCount - 1]?.[1] ?? 0) : last[1];
}

export const LIGHT_AA_WINDOW_DURATIONS = {
  LEVEL: 120,
  DIVE: 60,
  TORPEDO: 120,
  SKIP: 60,
  ROCKET: 60,
} as const;

export const LIGHT_AA_SPEED_BANDS = [
  [0, 10_000],
  [200, 7_500],
  [350, 5_000],
  [500, 2_500],
] as const;

export function lightAASpeedMultiplierBp(speedKnots: number): number {
  let bp: number = LIGHT_AA_SPEED_BANDS[0]?.[1] ?? 10_000;
  for (const [lowerKnots, multiplierBp] of LIGHT_AA_SPEED_BANDS) {
    if (speedKnots >= lowerKnots) bp = multiplierBp;
  }
  return bp;
}

export function effectiveLightAAWindowMilliseconds(
  baseWindowMilliseconds: number,
  speedWindowMultiplierBp: number,
): number {
  if (!SafeInt.isSafeInt(baseWindowMilliseconds)) {
    throw new BluewaveError(
      "effectiveLightAAWindowMilliseconds: baseWindowMilliseconds must be a safe integer",
      {
        code: INVALID_AIR_DEFENSE_SYSTEM_DEFINITION,
        baseWindowMilliseconds,
      },
    );
  }
  if (!SafeInt.isSafeInt(speedWindowMultiplierBp)) {
    throw new BluewaveError(
      "effectiveLightAAWindowMilliseconds: speedWindowMultiplierBp must be a safe integer",
      {
        code: INVALID_AIR_DEFENSE_SYSTEM_DEFINITION,
        speedWindowMultiplierBp,
      },
    );
  }
  const product = SafeInt.mul(SafeInt(baseWindowMilliseconds), SafeInt(speedWindowMultiplierBp));
  const scaled = SafeInt.div(product, SafeInt(10_000), "floor");
  const minMs = SafeInt(1_000);
  return Math.max(Number(minMs), Number(scaled));
}

export const BASE_DEFENSE_VALUES = {
  HEAVY_AA: {
    kill: 100,
    damage: 50,
    abort: 30,
    disruption: 15,
  },
  MEDIUM_AA: {
    kill: 50,
    damage: 25,
    abort: 15,
    disruption: 8,
  },
  LIGHT_AA: {
    kill: 20,
    damage: 10,
    abort: 5,
    disruption: 3,
  },
  CIWS_TERMINAL_DEFENSE: {
    kill: 80,
    damage: 40,
    abort: 20,
    disruption: 25,
  },
} as const;

export const LAYER_IDS = ["HEAVY_AA", "MEDIUM_AA", "LIGHT_AA", "CIWS_TERMINAL_DEFENSE"] as const;

export const CATEGORY_IDS = [...LAYER_IDS] as const;

export const AIR_DEFENSE_MODEL_VERSION = "air_defense_v1" as const;

export const FULL_DEFENSE_LAYER_ORDER = [
  "CAP",
  "HEAVY_SAM",
  "MEDIUM_SAM",
  "LIGHT_SAM",
  "HEAVY_AA",
  "MEDIUM_AA",
  "LIGHT_AA",
  "CIWS_TERMINAL_DEFENSE",
] as const;

export const AIR_DEFENSE_FORMULA_VERSION = "air_defense_formula_v1" as const;

export const AIR_DEFENSE_BASIS_POINTS = 10_000 as const;

export const FORMULA_DENOMINATOR = 10_000 as const;
export const FORMULA_EXPONENT = 8 as const;

export const MAX_ENGAGEMENT_FACTOR_BP = 31_000 as const;

export const CREW_QUALITY_MIN = 0 as const;
export const CREW_QUALITY_MAX = 10_000 as const;

export const DISRUPTION_MULTIPLIERS = {
  LIGHT: { accuracyBp: 9_000, cohesionBp: 9_500 },
  MODERATE: { accuracyBp: 7_500, cohesionBp: 8_500 },
  SEVERE: { accuracyBp: 5_000, cohesionBp: 6_500 },
  MISSION_ABORT: { accuracyBp: 0, cohesionBp: 0 },
} as const;

export const OPERATIONAL_MULTIPLIER_BP = 10_000 as const;
export const DAMAGED_MULTIPLIER_BP = 5_000 as const;
export const DESTROYED_MULTIPLIER_BP = 0 as const;

export const LOCAL_CONTROL_MULTIPLIER_BP = 5_000 as const;

export const STATE_HASH_LENGTH = 64 as const;

export const INVALID_AIR_DEFENSE_STATE = "INVALID_AIR_DEFENSE_STATE" as const;
export const INVALID_AIR_DEFENSE_SYSTEM_DEFINITION =
  "INVALID_AIR_DEFENSE_SYSTEM_DEFINITION" as const;
