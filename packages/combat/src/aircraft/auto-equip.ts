import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { AIRCRAFT_BASIS_POINTS_PER_UNIT, type AircraftType } from "./constants.js";
import { SQUADRON_AUTO_EQUIP_UNAVAILABLE } from "./reasonCodes.js";
import type { AircraftModelDefinition } from "./model.js";
import type { SquadronState } from "./state.js";

export const AUTO_EQUIP_STRENGTH_THRESHOLD_BP = 7_500 as const;

export interface AutoEquipEligibilityInput {
  squadron: SquadronState;
  compatibleModels: readonly AircraftModelDefinition[];
  unassignedOperationalInventory: ReadonlyMap<string, SafeInt>;
  basingCapacityAvailable: SafeInt;
  pilotPoolAvailable: SafeInt;
  maintenanceSupportAvailable: boolean;
  assetAutomationLock: boolean;
}

export type AutoEquipEligibilityResult = { eligible: true } | { eligible: false; reason: string };

export function checkAutoEquipEligibility(
  input: AutoEquipEligibilityInput,
): AutoEquipEligibilityResult {
  if (input.assetAutomationLock) {
    return { eligible: false, reason: "ASSET_AUTOMATION_LOCK" };
  }

  if (input.squadron.assignedModelId !== null) {
    return { eligible: false, reason: "ALREADY_ASSIGNED" };
  }

  if (input.compatibleModels.length === 0) {
    return { eligible: false, reason: "NO_COMPATIBLE_MODELS" };
  }

  if (!input.maintenanceSupportAvailable) {
    return { eligible: false, reason: "MAINTENANCE_SUPPORT_UNAVAILABLE" };
  }

  return { eligible: true };
}

export interface AutoEquipSelectionInput {
  models: readonly AircraftModelDefinition[];
  inventory: ReadonlyMap<string, SafeInt>;
  authorizedStrength: SafeInt;
}

export interface AutoEquipSelectionResult {
  selectedModel: AircraftModelDefinition | null;
}

export function selectAutoEquipModel(input: AutoEquipSelectionInput): AutoEquipSelectionResult {
  const thresholdBp = SafeInt.mul(
    SafeInt(AUTO_EQUIP_STRENGTH_THRESHOLD_BP),
    input.authorizedStrength,
  );
  const requiredUnits = SafeInt.div(thresholdBp, SafeInt(AIRCRAFT_BASIS_POINTS_PER_UNIT));

  const ranked = [...input.models]
    .filter((m) => {
      const available = input.inventory.get(m.aircraftModelId) ?? SafeInt.ZERO;
      return available >= requiredUnits;
    })
    .sort((a, b) => {
      const roleFitA = computeRoleFitScore(a, b.aircraftType);
      const roleFitB = computeRoleFitScore(b, a.aircraftType);
      if (roleFitB !== roleFitA) return roleFitB - roleFitA;
      const genA = a.introductionMonth;
      const genB = b.introductionMonth;
      if (genB !== genA) return genB.localeCompare(genA);
      const burdenA = SafeInt.add(a.productionWork, a.maintenanceRequirement);
      const burdenB = SafeInt.add(b.productionWork, b.maintenanceRequirement);
      if (Number(burdenB) !== Number(burdenA)) return Number(burdenA) - Number(burdenB);
      return a.aircraftModelId.localeCompare(b.aircraftModelId);
    });

  return { selectedModel: ranked[0] ?? null };
}

function computeRoleFitScore(model: AircraftModelDefinition, role: AircraftType): number {
  return model.eligibleRoleIds.includes(role) ? 100 : 0;
}

export function assertAutoEquipAvailable(selected: boolean): void {
  if (!selected) {
    throw new BluewaveError(SQUADRON_AUTO_EQUIP_UNAVAILABLE, {
      code: SQUADRON_AUTO_EQUIP_UNAVAILABLE,
      reason: "no model with sufficient inventory meets selection criteria",
    });
  }
}
