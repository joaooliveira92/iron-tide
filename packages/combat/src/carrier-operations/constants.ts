export const CARRIER_OPERATIONS_RULESET_VERSION = "carrier_operations_ruleset_v1" as const;
export const CARRIER_OPERATIONS_FORMULA_VERSION = "carrier_operations_formula_v1" as const;
export const CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT = 10_000 as const;

export const CARRIER_CLASSIFICATIONS = ["CVL", "CV"] as const;
export type CarrierClassification = (typeof CARRIER_CLASSIFICATIONS)[number];

export const CVL_MIN_CAPACITY = 4 as const;
export const CVL_MAX_CAPACITY = 34 as const;
export const CV_MIN_CAPACITY = 35 as const;

export const ORDINARY_SLOT_CAPACITY_UNITS = 2 as const;
export const PISTON_CAPACITY_UNITS = 2 as const;
export const LIGHT_JET_CAPACITY_UNITS = 3 as const;
export const HEAVY_JET_CAPACITY_UNITS = 3 as const;
export const HELICOPTER_CAPACITY_UNITS = 2 as const;

export const OVERSIZED_CARRIER_THRESHOLD = 100 as const;
export const OVERSIZED_DECK_CYCLE_EFFICIENCY_BP = 9_000 as const;
export const OVERSIZED_SORTIE_GENERATION_BP = 9_000 as const;
export const OVERSIZED_MAINTENANCE_COST_BP = 12_500 as const;
export const OVERSIZED_COORDINATION_BP = 9_500 as const;
export const OVERSIZED_HAZARD_BP = 11_000 as const;

export const DECK_CYCLE_STATES = [
  "UNREADY",
  "READYING",
  "SPOTTING",
  "SPOTTED",
  "LAUNCHING",
  "FORMING",
  "AIRBORNE",
  "RETURNING",
  "HOLDING",
  "LANDING",
  "REFUELING",
  "REARMING",
  "STRUCK_DOWN",
] as const;
export type DeckCycleState = (typeof DECK_CYCLE_STATES)[number];

export const CARRIER_OPERATIONS_PHASE_ORDER = 7.3 as const;
export const CARRIER_OPERATIONS_PHASE_ID = "resolve_carrier_operations" as const;

export const carrierOperationsPolicyId = "carrier_operations_v1" as const;
export const SPOT_VALUE_SCALE_EXPONENT = 6 as const;
export const SPOT_VALUE_DENOMINATOR: bigint =
  BigInt(CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT) ** BigInt(SPOT_VALUE_SCALE_EXPONENT);

export const SPOT_CATAPULT_NONE_BP = 10_000 as const;
export const SPOT_CATAPULT_ONE_BP = 11_000 as const;
export const SPOT_CATAPULT_TWO_PLUS_BP = 12_000 as const;

export const SPOT_SPEED_BELOW_20_BP = 6_000 as const;
export const SPOT_SPEED_20_24_BP = 8_000 as const;
export const SPOT_SPEED_24_28_BP = 10_000 as const;
export const SPOT_SPEED_28_PLUS_BP = 11_000 as const;

export const SPOT_DECK_STRAIGHT_BP = 10_000 as const;
export const SPOT_DECK_EDGE_LIFT_BP = 11_000 as const;
export const SPOT_DECK_ANGLED_BP = 12_000 as const;

export const SPOT_DAMAGE_OPERATIONAL_BP = 10_000 as const;
export const SPOT_DAMAGE_DEGRADED_BP = 7_500 as const;
export const SPOT_DAMAGE_HEAVY_BP = 3_500 as const;
export const SPOT_DAMAGE_INOPERABLE_BP = 0 as const;

export const SPOT_TECH_BASIC_BP = 10_000 as const;
export const SPOT_TECH_IMPROVED_BP = 11_000 as const;
export const SPOT_TECH_MODERN_BP = 12_000 as const;

export const JET_CARRIER_CAPABILITIES = [
  "NONE",
  "LIGHT_JET_CAPABLE",
  "HEAVY_JET_CAPABLE",
  "MODERN_JET_CAPABLE",
] as const;
export type JetCarrierCapability = (typeof JET_CARRIER_CAPABILITIES)[number];

export const LIGHT_JET_MIN_DISPLACEMENT_KG = 40_000_000 as const;
export const LIGHT_JET_MIN_DISPLACEMENT_WITH_CATAPULT_KG = 30_000_000 as const;
export const HEAVY_JET_MIN_DISPLACEMENT_KG = 40_000_000 as const;

export const LIGHT_JET_TECHNOLOGY = "av_carrier_jet" as const;
export const HEAVY_JET_TECHNOLOGY = "cop_heavy_jet_operations" as const;

export const SPOT_VALUE_CLAMP_MAX = 0 as const;

export const WOD_PISTON_LAUNCH_MIN_KNOTS = 20 as const;
export const WOD_PISTON_RECOVERY_MIN_KNOTS = 18 as const;
export const WOD_LIGHT_JET_LAUNCH_MIN_KNOTS = 25 as const;
export const WOD_LIGHT_JET_RECOVERY_MIN_KNOTS = 22 as const;
export const WOD_HEAVY_JET_LAUNCH_MIN_KNOTS = 30 as const;
export const WOD_HEAVY_JET_RECOVERY_MIN_KNOTS = 25 as const;
export const WOD_HELICOPTER_DEFAULT_MIN_KNOTS = 0 as const;
