export const DIVISION_ORDER_VERSION = "division_order_v1" as const;

export const DIVISION_ORDER_CONTROLS = ["PLAYER", "AI"] as const;

export const DIVISION_STANCES = ["ENGAGE", "HOLD", "WITHDRAW"] as const;

export const DIVISION_NAVIGATION_KINDS = ["STANCE", "COURSE", "WAYPOINT"] as const;

export const DIVISION_SPEED_KINDS = ["PERCENT", "KNOTS", "PRESET"] as const;

export const DIVISION_SPEED_PRESETS = [
  "CRUISE",
  "TWENTY",
  "TWENTY_FIVE",
  "MAX_MINUS_2",
  "SQUADRON_MAX",
] as const;

export const TWO_KNOTS_SPEED_BP = 2_000 as const;

export const DIVISION_ORDER_MAX_KNOTS = 60 as const;

export const DIVISION_ORDER_MAX_HEADING_DEG = 359 as const;
