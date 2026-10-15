// DESIGN-41 §§27-28 — Damage-control resource pools and priority allocation constants.
// Integer fixed-point arithmetic only; versioned policy identifiers for contract validation.

export const damageControlPolicyId = "damage_control_v1" as const;
export const DAMAGE_CONTROL_RULESET_VERSION = "damage_control_ruleset_v1" as const;
export const DAMAGE_CONTROL_FORMULA_VERSION = "damage_control_formula_v1" as const;

// ---- Resource types (§27) ----

export interface DamageControlResource {
  teamCount: number;
  pumpingCapacity: number; // kg/min
  firefightingCapacity: number; // bp/min intensity reduction
  emergencyPower: boolean;
  availableCrew: number;
  specialists: number;
  repairMaterials: number;
  compartmentAccess: string[];
}

// ---- Priority order (§28) — 9-step ordered list ----

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

// ---- Base resource pool for a typical surface combatant ----

export const BASE_TEAM_COUNT = 4;
export const BASE_PUMPING_CAPACITY_KG_MIN = 800;
export const BASE_FIREFIGHTING_CAPACITY_BP = 500;
export const BASE_CREW_AVAILABLE = 200;
export const BASE_SPECIALISTS = 8;
export const BASE_REPAIR_MATERIALS = 1_000;

// ---- Per-allocation resource budgets ----

/** Pumping capacity allocated per team assigned to a flooding task (kg/min). */
export const PUMPING_PER_TEAM_KG_MIN = 200;

/** Firefighting capacity allocated per team assigned to a fire task (bp/min intensity reduction). */
export const FIREFIGHTING_PER_TEAM_BP = 125;
