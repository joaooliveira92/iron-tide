//packages/combat/src/aircraft/reequipment.ts
// DESIGN-43 §§17-18 re-equipment: command, duration, unavailability, experience penalty.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { SQUADRON_REEQUIPMENT_INELIGIBLE } from "./reasonCodes.js";
import type { SquadronState } from "./state.js";

export const REEQUIPMENT_DURATION_MONTHS = 2 as const;
export const REEQUIPMENT_EXPERIENCE_PENALTY_BASE = 10 as const;
export const REEQUIPMENT_EXPERIENCE_PENALTY_FAMILY_CHANGE = 5 as const;
export const REEQUIPMENT_READINESS_MULTIPLIER_BP = 8_000 as const;
export const REEQUIPMENT_READINESS_DURATION_MONTHS = 3 as const;

export type PropulsionFamily = "PISTON" | "JET" | "HELICOPTER" | "FLOATPLANE" | "OTHER";

export function isFamilyChange(oldFamily: PropulsionFamily, newFamily: PropulsionFamily): boolean {
  if (oldFamily === newFamily) return false;
  const changePairs: ReadonlySet<string> = new Set([
    "PISTON->JET",
    "FIXED_WING->HELICOPTER",
    "LAND_PLANE->CARRIER_PLANE",
    "FLOATPLANE->WHEELED",
  ]);
  return changePairs.has(`${oldFamily}->${newFamily}`);
}

export interface ReequipmentEligibilityInput {
  squadron: SquadronState;
  hasSufficientInventory: boolean;
  hasBasingCapacity: boolean;
  hasPilotTrainingCapacity: boolean;
  hasConversionCost: boolean;
}

export type ReequipmentEligibilityResult = { eligible: true } | { eligible: false; reason: string };

export function checkReequipmentEligibility(
  input: ReequipmentEligibilityInput,
): ReequipmentEligibilityResult {
  if (!input.hasSufficientInventory) {
    return { eligible: false, reason: "INSUFFICIENT_INVENTORY" };
  }
  if (!input.hasBasingCapacity) {
    return { eligible: false, reason: "INSUFFICIENT_BASING_CAPACITY" };
  }
  if (!input.hasPilotTrainingCapacity) {
    return { eligible: false, reason: "INSUFFICIENT_PILOT_TRAINING" };
  }
  if (!input.hasConversionCost) {
    return { eligible: false, reason: "CONVERSION_COST_INSUFFICIENT" };
  }
  return { eligible: true };
}

export function assertReequipmentEligible(result: ReequipmentEligibilityResult): void {
  if (!result.eligible) {
    throw new BluewaveError(SQUADRON_REEQUIPMENT_INELIGIBLE, {
      code: SQUADRON_REEQUIPMENT_INELIGIBLE,
      reason: result.reason,
    });
  }
}

export function applyReequipmentExperiencePenalty(
  currentExperience: SafeInt,
  isFamilyChange: boolean,
): SafeInt {
  let penalty = REEQUIPMENT_EXPERIENCE_PENALTY_BASE;
  if (isFamilyChange) {
    penalty += REEQUIPMENT_EXPERIENCE_PENALTY_FAMILY_CHANGE;
  }
  const result = SafeInt.sub(currentExperience, SafeInt(penalty));
  const n = Number(result);
  if (n < 0) return SafeInt.ZERO;
  if (n > 100) return SafeInt(100);
  return result;
}

export function startReequipment(
  squadron: SquadronState,
  newModelId: string,
  _isFamilyChange: boolean,
  _currentMonth: string,
): SquadronState {
  return {
    ...squadron,
    assignedModelId: newModelId,
    reequipmentState: "IN_PROGRESS",
    operationalAircraftCount: SafeInt.ZERO,
  };
}

export function completeReequipment(
  squadron: SquadronState,
  isFamilyChange: boolean,
): SquadronState {
  const newExperience = applyReequipmentExperiencePenalty(
    squadron.squadronExperience,
    isFamilyChange,
  );
  return {
    ...squadron,
    reequipmentState: "COMPLETED",
    squadronExperience: newExperience,
  };
}
