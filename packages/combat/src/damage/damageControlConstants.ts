export const damageControlPolicyId = "damage_control_v1" as const;
export const DAMAGE_CONTROL_RULESET_VERSION = "damage_control_ruleset_v1" as const;
export const DAMAGE_CONTROL_FORMULA_VERSION = "damage_control_formula_v1" as const;

export interface DamageControlResource {
  teamCount: number;
  pumpingCapacity: number;
  firefightingCapacity: number;
  emergencyPower: boolean;
  availableCrew: number;
  specialists: number;
  repairMaterials: number;
  compartmentAccess: string[];
}

export const DAMAGE_CONTROL_PRIORITIES = [
  "MAGAZINE_TORPEDO_AVIATION_REACTOR",
  "CRITICAL_FLOODING",
  "UNCONTROLLED_MAJOR_FIRE",
  "STEERING_PROPULSION",
  "ELECTRICAL_POWER",
  "FIRE_CONTROL_COMMUNICATIONS",
  "WEAPON_RESTORATION",
  "NON_CRITICAL_DEWATERING",
  "COSMETIC_REPAIR",
] as const;

export type DamageControlPriority = (typeof DAMAGE_CONTROL_PRIORITIES)[number];

export const BASE_TEAM_COUNT = 4;
export const BASE_PUMPING_CAPACITY_KG_MIN = 800;
export const BASE_FIREFIGHTING_CAPACITY_BP = 500;
export const BASE_CREW_AVAILABLE = 200;
export const BASE_SPECIALISTS = 8;
export const BASE_REPAIR_MATERIALS = 1_000;

export const PUMPING_PER_TEAM_KG_MIN = 200;

export const FIREFIGHTING_PER_TEAM_BP = 125;
