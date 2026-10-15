// DESIGN-43 §19 squadron expansion: ratio formula, penalty bands, same-month aggregation.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { SQUADRON_EXPANSION_INELIGIBLE } from "./reasonCodes.js";
import type { SquadronState } from "./state.js";

export const EXPANSION_BAND_1_LIMIT_BP = 2_500 as const;
export const EXPANSION_BAND_2_LIMIT_BP = 5_000 as const;
export const EXPANSION_PENALTY_BAND_1 = 5 as const;
export const EXPANSION_PENALTY_BAND_2 = 10 as const;
export const EXPANSION_PENALTY_BAND_3 = 20 as const;

export function computeExpansionRatioBp(addedStrength: SafeInt, priorStrength: SafeInt): SafeInt {
  const prior = Number(priorStrength) < 1 ? SafeInt.ONE : priorStrength;
  const ratio = SafeInt.div(SafeInt.mul(addedStrength, SafeInt(10_000)), prior);
  return ratio;
}

export function selectExpansionPenalty(aggregatedRatioBp: SafeInt): number {
  const bp = Number(aggregatedRatioBp);
  if (bp <= EXPANSION_BAND_1_LIMIT_BP) return EXPANSION_PENALTY_BAND_1;
  if (bp <= EXPANSION_BAND_2_LIMIT_BP) return EXPANSION_PENALTY_BAND_2;
  return EXPANSION_PENALTY_BAND_3;
}

export interface ExpansionEligibilityInput {
  squadron: SquadronState;
  hasAircraftInventory: boolean;
  hasPilots: boolean;
  hasBasingCapacity: boolean;
  hasMaintenanceSupport: boolean;
  hasCommandAuthorization: boolean;
}

export type ExpansionEligibilityResult = { eligible: true } | { eligible: false; reason: string };

export function checkExpansionEligibility(
  input: ExpansionEligibilityInput,
): ExpansionEligibilityResult {
  if (!input.hasAircraftInventory) {
    return { eligible: false, reason: "INSUFFICIENT_AIRCRAFT_INVENTORY" };
  }
  if (!input.hasPilots) {
    return { eligible: false, reason: "INSUFFICIENT_PILOTS" };
  }
  if (!input.hasBasingCapacity) {
    return { eligible: false, reason: "INSUFFICIENT_BASING_CAPACITY" };
  }
  if (!input.hasMaintenanceSupport) {
    return { eligible: false, reason: "MAINTENANCE_SUPPORT_UNAVAILABLE" };
  }
  if (!input.hasCommandAuthorization) {
    return { eligible: false, reason: "NO_COMMAND_AUTHORIZATION" };
  }
  return { eligible: true };
}

export function assertExpansionEligible(result: ExpansionEligibilityResult): void {
  if (!result.eligible) {
    throw new BluewaveError(SQUADRON_EXPANSION_INELIGIBLE, {
      code: SQUADRON_EXPANSION_INELIGIBLE,
      reason: result.reason,
    });
  }
}

export function applyExpansionPenalty(
  currentExperience: SafeInt,
  aggregatedRatioBp: SafeInt,
): SafeInt {
  const penalty = selectExpansionPenalty(aggregatedRatioBp);
  const result = SafeInt.sub(currentExperience, SafeInt(penalty));
  const n = Number(result);
  if (n < 0) return SafeInt.ZERO;
  if (n > 100) return SafeInt(100);
  return result;
}
