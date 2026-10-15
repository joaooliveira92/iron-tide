// DESIGN-41 §§27-28 — Damage-control resource allocation and priority scheduling.
//
// Pure/deterministic: no ambient I/O/clock/random. Integer fixed-point arithmetic only.
// Allocates damage-control resources (teams, pumping, firefighting) to active fire and
// flooding sources using the 9-step priority order (§28).

import { type FireSourceRecord, type FloodingSourceRecord } from "./state.js";
import { getFloodingSeverity } from "./floodingResolution.js";
import type { FloodingSeverity } from "./floodingResolution.js";
import {
  type DamageControlResource,
  type DamageControlPriority,
  DAMAGE_CONTROL_PRIORITIES,
  BASE_TEAM_COUNT,
  BASE_PUMPING_CAPACITY_KG_MIN,
  BASE_FIREFIGHTING_CAPACITY_BP,
  BASE_CREW_AVAILABLE,
  BASE_SPECIALISTS,
  BASE_REPAIR_MATERIALS,
  PUMPING_PER_TEAM_KG_MIN,
  FIREFIGHTING_PER_TEAM_BP,
} from "./damageControlConstants.js";

// Exported types

export interface DamageControlAllocation {
  priority: DamageControlPriority;
  allocatedTeams: number;
  allocatedPumping: number;
  allocatedFirefighting: number;
  targetId: string; // fire location or flooding compartment
  severity: string; // severity level
}

export interface AllocationResult {
  allocations: DamageControlAllocation[];
  remainingResources: DamageControlResource;
}

// Internal helper types

interface AllocationTask {
  priority: DamageControlPriority;
  priorityIndex: number;
  severityScore: number; // numeric — higher = more severe
  targetId: string;
  severityLabel: string; // human-readable severity string
  kind: "fire" | "flood";
}

// Priority helpers

/**
 * Get the numeric index of a priority in the DAMAGE_CONTROL_PRIORITIES list.
 * Lower index = higher priority. Returns -1 if not found (should not happen
 * for well-formed inputs).
 */
function getPriorityIndex(priority: DamageControlPriority): number {
  return DAMAGE_CONTROL_PRIORITIES.indexOf(priority);
}

/**
 * Map fire intensity to priority category.
 * Intensity >= 5_000 is "UNCONTROLLED_MAJOR_FIRE" priority.
 * Otherwise, fire is deferred to "WEAPON_RESTORATION".
 */
export function getFirePriorityCategory(intensityBp: number): DamageControlPriority {
  if (intensityBp >= 5_000) {
    return "UNCONTROLLED_MAJOR_FIRE";
  }
  return "WEAPON_RESTORATION";
}

/**
 * Map flooding severity to priority category.
 * CRITICAL / MAJOR → CRITICAL_FLOODING
 * SERIOUS / MINOR  → NON_CRITICAL_DEWATERING
 */
export function getFloodingPriorityCategory(severity: FloodingSeverity): DamageControlPriority {
  if (severity === "CRITICAL" || severity === "MAJOR") {
    return "CRITICAL_FLOODING";
  }
  return "NON_CRITICAL_DEWATERING";
}

/**
 * Convert a FloodingSeverity to a numeric rank for sorting.
 * Lower rank = more severe. Used for ordering within equal priority.
 */
function floodingSeverityRank(severity: FloodingSeverity): number {
  switch (severity) {
    case "CRITICAL":
      return 0;
    case "MAJOR":
      return 1;
    case "SERIOUS":
      return 2;
    case "MINOR":
      return 3;
  }
}

// Default resource factory

/**
 * Create default damage-control resource pool for a ship.
 */
export function createDefaultDamageControlResource(): DamageControlResource {
  return {
    teamCount: BASE_TEAM_COUNT,
    pumpingCapacity: BASE_PUMPING_CAPACITY_KG_MIN,
    firefightingCapacity: BASE_FIREFIGHTING_CAPACITY_BP,
    emergencyPower: false,
    availableCrew: BASE_CREW_AVAILABLE,
    specialists: BASE_SPECIALISTS,
    repairMaterials: BASE_REPAIR_MATERIALS,
    compartmentAccess: [],
  };
}

// Effective capacity helpers

/**
 * Get effective pumping capacity after damage-control allocation (kg/min).
 */
export function getEffectivePumping(allocations: DamageControlAllocation[]): number {
  let total = 0;
  for (let i = 0; i < allocations.length; i++) {
    total += allocations[i]!.allocatedPumping;
  }
  return total;
}

/**
 * Get effective firefighting capacity after damage-control allocation (bp/min).
 */
export function getEffectiveFirefighting(allocations: DamageControlAllocation[]): number {
  let total = 0;
  for (let i = 0; i < allocations.length; i++) {
    total += allocations[i]!.allocatedFirefighting;
  }
  return total;
}

/**
 * Get effective repair reduction after damage-control allocation (kg/min).
 */
export function getEffectiveRepairReduction(allocations: DamageControlAllocation[]): number {
  // Repair reduction is based on teams allocated: each team contributes
  // to repair at a flat rate. For simplicity, we treat team-based repair
  // as half of the pumping rate per team.
  let totalTeams = 0;
  for (let i = 0; i < allocations.length; i++) {
    totalTeams += allocations[i]!.allocatedTeams;
  }
  return totalTeams * 50; // 50 kg/min per allocated team
}

// Allocation engine

/**
 * Allocate damage-control resources to active fire and flooding sources
 * using the 9-step priority order (DESIGN-41 §28).
 *
 * For each priority level, distribute resources to the highest-severity
 * sources first. Equal-priority sources are ordered by severity descending
 * and source identifier ascending.
 *
 * No double-allocation: a unit of resource is allocated to exactly one task.
 *
 * @param resources - Available damage-control resources.
 * @param fireRecords - Active fire source records.
 * @param floodingRecords - Active flooding source records.
 * @param floodedWaterBp - Current accumulated flooded water as basis points of
 *   displacement (`floodedWaterBpFromKg` conversion — ADR-0047 decision 4).
 *   Callers MUST pass bp, never the kg mass surface.
 * @returns Allocation result with allocations and remaining resources.
 */
export function allocateDamageControl(
  resources: DamageControlResource,
  fireRecords: FireSourceRecord[],
  floodingRecords: FloodingSourceRecord[],
  floodedWaterBp: number,
): AllocationResult {
  // ---- Build task list ----
  const tasks: AllocationTask[] = [];
  const floodingSeverity = getFloodingSeverity(floodedWaterBp);

  // Fire tasks
  for (let i = 0; i < fireRecords.length; i++) {
    const fire = fireRecords[i]!;
    const priority = getFirePriorityCategory(fire.intensityBp);
    tasks.push({
      priority,
      priorityIndex: getPriorityIndex(priority),
      severityScore: fire.intensityBp, // higher intensity = more severe
      targetId: fire.locationId,
      severityLabel: `intensity_${fire.intensityBp}`,
      kind: "fire",
    });
  }

  // Flooding tasks
  for (let i = 0; i < floodingRecords.length; i++) {
    const flood = floodingRecords[i]!;
    const priority = getFloodingPriorityCategory(floodingSeverity);
    tasks.push({
      priority,
      priorityIndex: getPriorityIndex(priority),
      severityScore: floodingSeverityRank(floodingSeverity) * -1 + 100, // severe => high score
      targetId: flood.compartmentId,
      severityLabel: floodingSeverity,
      kind: "flood",
    });
  }

  // ---- Sort tasks ----
  // Primary: priority index ascending (lower = higher priority)
  // Secondary: severity score descending (higher = more severe)
  // Tertiary: target id ascending (deterministic tiebreak)
  tasks.sort((a, b) => {
    if (a.priorityIndex !== b.priorityIndex) return a.priorityIndex - b.priorityIndex;
    if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
    return a.targetId.localeCompare(b.targetId);
  });

  // ---- Allocate ----
  const allocations: DamageControlAllocation[] = [];
  let remaining = {
    teamCount: resources.teamCount,
    pumpingCapacity: resources.pumpingCapacity,
    firefightingCapacity: resources.firefightingCapacity,
    emergencyPower: resources.emergencyPower,
    availableCrew: resources.availableCrew,
    specialists: resources.specialists,
    repairMaterials: resources.repairMaterials,
    compartmentAccess: [...resources.compartmentAccess],
  };

  for (let t = 0; t < tasks.length; t++) {
    const task = tasks[t]!;

    // No teams remaining — cannot allocate further
    if (remaining.teamCount <= 0) break;

    // Allocate 1 team per task
    const allocatedTeams = 1;
    let allocatedPumping = 0;
    let allocatedFirefighting = 0;

    if (task.kind === "flood") {
      allocatedPumping = Math.min(PUMPING_PER_TEAM_KG_MIN, remaining.pumpingCapacity);
    } else {
      allocatedFirefighting = Math.min(FIREFIGHTING_PER_TEAM_BP, remaining.firefightingCapacity);
    }

    remaining.teamCount -= allocatedTeams;
    remaining.pumpingCapacity -= allocatedPumping;
    remaining.firefightingCapacity -= allocatedFirefighting;

    allocations.push({
      priority: task.priority,
      allocatedTeams,
      allocatedPumping,
      allocatedFirefighting,
      targetId: task.targetId,
      severity: task.severityLabel,
    });
  }

  return {
    allocations,
    remainingResources: remaining,
  };
}
