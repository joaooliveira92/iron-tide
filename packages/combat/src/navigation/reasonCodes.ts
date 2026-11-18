export const GRATES_FOULED = "GRATES_FOULED" as const;
export const STOKERS_EXHAUSTED = "STOKERS_EXHAUSTED" as const;
export const BREAKDOWN = "BREAKDOWN" as const;
export const FLOODING_DAMAGE = "FLOODING_DAMAGE" as const;
export const DIVISION_CLAMP = "DIVISION_CLAMP" as const;
export const NAVIGATION_RULES_INVALID = "NAVIGATION_RULES_INVALID" as const;
export const SEPARATION = "SEPARATION" as const;
export const SEPARATION_REJOIN = "SEPARATION_REJOIN" as const;
export const STATION_DRIFT = "STATION_DRIFT" as const;

export type SeparationReasonCode =
  | typeof SEPARATION
  | typeof SEPARATION_REJOIN
  | typeof STATION_DRIFT;

export const NAVIGATION_SPEED_REASON_CODES = {
  GRATES_FOULED,
  STOKERS_EXHAUSTED,
  BREAKDOWN,
  FLOODING_DAMAGE,
  DIVISION_CLAMP,
} as const;

export type NavigationSpeedReasonCode =
  (typeof NAVIGATION_SPEED_REASON_CODES)[keyof typeof NAVIGATION_SPEED_REASON_CODES];
