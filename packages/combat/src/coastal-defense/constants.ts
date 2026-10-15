export const coastalBatteryPolicyId = "coastal_battery_v1" as const;
export const landTargetTypePolicyId = "land_target_types_v1" as const;
export const landTargetDamageStatePolicyId = "land_target_damage_states_v1" as const;
export const coastalDefensePlacementPolicyId = "coastal_defense_placement_v1" as const;
export const coastalDefenseMinePressurePolicyId = "coastal_defense_mine_pressure_v1" as const;
export const coastalDefenseEffectivenessPolicyId = "coastal_defense_effectiveness_v1" as const;
export const coastalDefenseRecordsPolicyId = "coastal_defense_records_v1" as const;

export const COASTAL_DEFENSE_RULESET_VERSION = "coastal_defense_ruleset_v1" as const;
export const COASTAL_DEFENSE_FORMULA_VERSION = "coastal_defense_formula_v1" as const;

export const COASTAL_DEFENSE_BASIS_POINTS_PER_UNIT = 10_000 as const;

export const LAND_TARGET_TYPES = [
  "AIRFIELD",
  "DOCKYARD",
  "FUEL_STORAGE",
  "RADAR_STATION",
  "COASTAL_BATTERY",
  "PORT_INSTALLATION",
  "TRANSPORT_CONCENTRATION",
] as const;
export type LandTargetType = (typeof LAND_TARGET_TYPES)[number];

export const LAND_TARGET_DAMAGE_STATES = [
  "INTACT",
  "SUPPRESSED",
  "DAMAGED",
  "DISABLED",
  "DESTROYED",
] as const;
export type LandTargetDamageState = (typeof LAND_TARGET_DAMAGE_STATES)[number];

export const COASTAL_BATTERY_ERA_BANDS = [
  "EARLY",
  "PRE_WAR",
  "INTERWAR",
  "MID_CENTURY",
  "LATE",
] as const;
export type CoastalBatteryEraBand = (typeof COASTAL_BATTERY_ERA_BANDS)[number];

export const DAMAGE_EVENT_TYPES = ["BOMBARDMENT", "SHELLING", "ASSAULT"] as const;
export type DamageEventType = (typeof DAMAGE_EVENT_TYPES)[number];

export const COASTAL_DEFENSE_BATTERY_MODELS = [
  "GENERIC_HEAVY",
  "GENERIC_MEDIUM",
  "GENERIC_LIGHT",
] as const;
export type CoastalBatteryModel = (typeof COASTAL_DEFENSE_BATTERY_MODELS)[number];

export const PER_BATTERY_MINE_PRESSURE_INCREMENT = 500 as const;
export const BASE_EFFECTIVENESS_BP = 8_000 as const;
export const MIN_CALIBER_MM = 75 as const;
export const MAX_CALIBER_MM = 460 as const;
