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
import { compareStrings } from "../core/ordering.js";

export interface DamageControlAllocation {
  priority: DamageControlPriority;
  allocatedTeams: number;
  allocatedPumping: number;
  allocatedFirefighting: number;
  targetId: string;
  severity: string;
}

export interface AllocationResult {
  allocations: DamageControlAllocation[];
  remainingResources: DamageControlResource;
}

interface AllocationTask {
  priority: DamageControlPriority;
  priorityIndex: number;
  severityScore: number;
  targetId: string;
  severityLabel: string;
  kind: "fire" | "flood";
}

function getPriorityIndex(priority: DamageControlPriority): number {
  return DAMAGE_CONTROL_PRIORITIES.indexOf(priority);
}

export function getFirePriorityCategory(intensityBp: number): DamageControlPriority {
  if (intensityBp >= 5_000) {
    return "UNCONTROLLED_MAJOR_FIRE";
  }
  return "WEAPON_RESTORATION";
}

export function getFloodingPriorityCategory(severity: FloodingSeverity): DamageControlPriority {
  if (severity === "CRITICAL" || severity === "MAJOR") {
    return "CRITICAL_FLOODING";
  }
  return "NON_CRITICAL_DEWATERING";
}

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

export function getEffectivePumping(allocations: DamageControlAllocation[]): number {
  let total = 0;
  for (let i = 0; i < allocations.length; i++) {
    total += allocations[i]!.allocatedPumping;
  }
  return total;
}

export function getEffectiveFirefighting(allocations: DamageControlAllocation[]): number {
  let total = 0;
  for (let i = 0; i < allocations.length; i++) {
    total += allocations[i]!.allocatedFirefighting;
  }
  return total;
}

export function getEffectiveRepairReduction(allocations: DamageControlAllocation[]): number {
  let totalTeams = 0;
  for (let i = 0; i < allocations.length; i++) {
    totalTeams += allocations[i]!.allocatedTeams;
  }
  return totalTeams * 50;
}

export function allocateDamageControl(
  resources: DamageControlResource,
  fireRecords: FireSourceRecord[],
  floodingRecords: FloodingSourceRecord[],
  floodedWaterBp: number,
): AllocationResult {
  const tasks: AllocationTask[] = [];
  const floodingSeverity = getFloodingSeverity(floodedWaterBp);

  for (let i = 0; i < fireRecords.length; i++) {
    const fire = fireRecords[i]!;
    const priority = getFirePriorityCategory(fire.intensityBp);
    tasks.push({
      priority,
      priorityIndex: getPriorityIndex(priority),
      severityScore: fire.intensityBp,
      targetId: fire.locationId,
      severityLabel: `intensity_${fire.intensityBp}`,
      kind: "fire",
    });
  }

  for (let i = 0; i < floodingRecords.length; i++) {
    const flood = floodingRecords[i]!;
    const priority = getFloodingPriorityCategory(floodingSeverity);
    tasks.push({
      priority,
      priorityIndex: getPriorityIndex(priority),
      severityScore: floodingSeverityRank(floodingSeverity) * -1 + 100,
      targetId: flood.compartmentId,
      severityLabel: floodingSeverity,
      kind: "flood",
    });
  }

  tasks.sort((a, b) => {
    if (a.priorityIndex !== b.priorityIndex) return a.priorityIndex - b.priorityIndex;
    if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
    return compareStrings(a.targetId, b.targetId);
  });

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

    if (remaining.teamCount <= 0) break;

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
