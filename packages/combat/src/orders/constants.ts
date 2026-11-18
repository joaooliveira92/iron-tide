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

export const UM_PER_METRE = 1_000_000 as const;

export const WAYPOINT_ARRIVAL_TOLERANCE_METRES = 1_000 as const;

export const WAYPOINT_MAX_METRES = 500_000 as const;

export const WAYPOINT_REACHED_EVENT_TYPE = "waypoint_reached" as const;
