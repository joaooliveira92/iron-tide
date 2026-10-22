export const AIRCRAFT_RULESET_VERSION = "aircraft_ruleset_v1" as const;
export const AIRCRAFT_FORMULA_VERSION = "aircraft_formula_v1" as const;

export const AIRCRAFT_BASIS_POINTS_PER_UNIT = 10_000 as const;

export const AIRCRAFT_TYPES = [
  "FIGHTER",
  "TORPEDO_BOMBER",
  "DIVE_BOMBER",
  "MEDIUM_BOMBER",
  "PATROL_AIRCRAFT",
  "FLOATPLANE_SCOUT",
  "AIRSHIP",
  "LIGHT_JET_FIGHTER",
  "HEAVY_JET_FIGHTER",
  "JET_ATTACK_AIRCRAFT",
  "HELICOPTER",
  "SPECIAL_SQUADRON",
] as const;
export type AircraftType = (typeof AIRCRAFT_TYPES)[number];

export const AIRCRAFT_TRAITS = [
  "SPEED",
  "FIREPOWER",
  "MANEUVERABILITY",
  "TOUGHNESS",
  "PAYLOAD",
  "RANGE",
  "RELIABILITY",
  "CARRIER_SUITABILITY",
  "EASE_OF_PRODUCTION",
] as const;
export type AircraftTrait = (typeof AIRCRAFT_TRAITS)[number];

export const AIRCRAFT_INVENTORY_STATES = [
  "UNASSIGNED_OPERATIONAL",
  "ASSIGNED_OPERATIONAL",
  "DAMAGED_REPAIRABLE",
  "DAMAGED_AWAITING_CAPACITY",
  "UNDER_REPAIR",
  "RESERVED_FOR_REEQUIPMENT",
  "WRITTEN_OFF",
  "CAPTURED",
  "LOST",
] as const;
export type AircraftInventoryState = (typeof AIRCRAFT_INVENTORY_STATES)[number];

export const AIRCRAFT_BASING_CLASSES = [
  "LAND_BASED",
  "CARRIER_BASED",
  "SEAPLANE_SUPPORTED",
  "AIRSHIP_BASED",
  "HELICOPTER_DECK_BASED",
  "SPECIAL_EXPLICIT",
] as const;
export type AircraftBasingClass = (typeof AIRCRAFT_BASING_CLASSES)[number];

export const AIRCRAFT_DAMAGED_DISPOSITIONS = [
  "REPAIR_LOCALLY",
  "AWAIT_REPAIR_CAPACITY",
  "TRANSFER_FOR_REPAIR",
  "WRITE_OFF",
  "CANNIBALIZE",
  "CAPTURED",
  "LOST",
] as const;
export type AircraftDamagedDisposition = (typeof AIRCRAFT_DAMAGED_DISPOSITIONS)[number];

export const SQUADRON_REEQUIPMENT_STATES = ["NONE", "IN_PROGRESS", "COMPLETED"] as const;
export type SquadronReequipmentState = (typeof SQUADRON_REEQUIPMENT_STATES)[number];

export const AIRCRAFT_PROJECT_STATUSES = [
  "REQUESTED",
  "DEVELOPING",
  "DELAYED",
  "READY_FOR_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
] as const;
export type AircraftProjectStatus = (typeof AIRCRAFT_PROJECT_STATUSES)[number];

export const AIRCRAFT_SCORE_MIN = 0 as const;
export const AIRCRAFT_SCORE_MAX = 100 as const;

export const AIRCRAFT_DESIGN_STREAM_KEY_PREFIX = "aircraft/development/nation" as const;

export const PRIVATE_VENTURE_COOLDOWN_MONTHS = 12 as const;

export const PRIVATE_VENTURE_MAX_UNEXPIRED = 3 as const;

export const PRIVATE_PROPOSAL_LIFETIME_MONTHS = 12 as const;

export const AIRCRAFT_DEVELOPMENT_BASE_MONTHS = 4 as const;
export const AIRCRAFT_DEVELOPMENT_MIN_MONTHS = 3 as const;
export const AIRCRAFT_DEVELOPMENT_MAX_MONTHS = 6 as const;
export const AIRCRAFT_DEVELOPMENT_COMPLEXITY_MODIFIER = 1 as const;
export const AIRCRAFT_DEVELOPMENT_TECHNOLOGY_MODIFIER = -1 as const;
export const AIRCRAFT_DEVELOPMENT_INDUSTRY_MODIFIER = -1 as const;

export const AIRCRAFT_ROLE_BASELINES: Record<string, readonly [number, number, number, number]> = {
  FIGHTER: [40, 25, 50, 30],
  TORPEDO_BOMBER: [20, 30, 20, 35],
  DIVE_BOMBER: [25, 35, 25, 30],
  MEDIUM_BOMBER: [20, 40, 15, 40],
  PATROL_AIRCRAFT: [15, 15, 10, 35],
  FLOATPLANE_SCOUT: [15, 10, 15, 25],
  AIRSHIP: [5, 5, 5, 20],
  LIGHT_JET_FIGHTER: [60, 35, 55, 35],
  HEAVY_JET_FIGHTER: [55, 45, 45, 45],
  JET_ATTACK_AIRCRAFT: [50, 50, 40, 40],
  HELICOPTER: [10, 20, 25, 25],
  SPECIAL_SQUADRON: [30, 30, 30, 30],
};

export const AIRCRAFT_TRAIT_BONUS: Record<string, number> = {
  SPEED: 10,
  FIREPOWER: 10,
  MANEUVERABILITY: 10,
  TOUGHNESS: 10,
  PAYLOAD: 0,
  RANGE: 0,
  RELIABILITY: 0,
  CARRIER_SUITABILITY: 0,
  EASE_OF_PRODUCTION: 0,
};

export const AIRCRAFT_TRADE_OFF_PENALTY = -5 as const;

export const AIRCRAFT_ROLE_ATTRIBUTE_MINS: Record<
  string,
  readonly [number, number, number, number]
> = {
  FIGHTER: [10, 5, 10, 5],
  TORPEDO_BOMBER: [5, 10, 5, 10],
  DIVE_BOMBER: [5, 10, 5, 5],
  MEDIUM_BOMBER: [5, 10, 5, 10],
  PATROL_AIRCRAFT: [5, 5, 5, 10],
  FLOATPLANE_SCOUT: [5, 5, 5, 5],
  AIRSHIP: [1, 1, 1, 5],
  LIGHT_JET_FIGHTER: [20, 10, 20, 10],
  HEAVY_JET_FIGHTER: [15, 15, 15, 15],
  JET_ATTACK_AIRCRAFT: [15, 20, 10, 10],
  HELICOPTER: [5, 5, 10, 5],
  SPECIAL_SQUADRON: [10, 10, 10, 10],
};
