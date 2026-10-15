import { ALLIED_SUPPORT_INELIGIBLE, ALLIED_OPERATIONAL_ACCESS_MISSING } from "./reasonCodes.js";
import { BluewaveError } from "@bluewave/contracts";

export const ALLIED_MAX_STRENGTH_BP = 5_000; // 50%
export const ALLIED_MAX_STRENGTH_DIVISOR = 10_000;

// DESIGN-37 §17: maximumAlliedStrength = floor(homeNationPersistentStrength * 5_000 / 10_000).
export function maximumAlliedStrength(homeNationPersistentStrength: number): number {
  return Math.floor(
    (homeNationPersistentStrength * ALLIED_MAX_STRENGTH_BP) / ALLIED_MAX_STRENGTH_DIVISOR,
  );
}

export interface AlliedCandidate {
  assetId: string;
  treatyCommitmentPriority: number;
  missionFit: number;
  effectiveStrength: number;
  nationId: string;
}

// DESIGN-37 §17 ordering: commitment priority → mission fit → strength → nationId → assetId.
export function orderAlliedCandidates(candidates: AlliedCandidate[]): AlliedCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.treatyCommitmentPriority !== b.treatyCommitmentPriority)
      return a.treatyCommitmentPriority - b.treatyCommitmentPriority;
    if (b.missionFit !== a.missionFit) return b.missionFit - a.missionFit;
    if (b.effectiveStrength !== a.effectiveStrength)
      return b.effectiveStrength - a.effectiveStrength;
    if (a.nationId !== b.nationId) return a.nationId.localeCompare(b.nationId);
    return a.assetId.localeCompare(b.assetId);
  });
}

// B-1 ships eligibility checks + structural cap + ordering only (no AI conduct).
export function assertAlliedEligible(
  hasAccess: boolean,
  authorized: boolean,
  context?: Record<string, unknown>,
): void {
  if (!hasAccess) {
    throw new BluewaveError(ALLIED_OPERATIONAL_ACCESS_MISSING, {
      code: ALLIED_OPERATIONAL_ACCESS_MISSING,
      ...context,
    });
  }
  if (!authorized) {
    throw new BluewaveError(ALLIED_SUPPORT_INELIGIBLE, {
      code: ALLIED_SUPPORT_INELIGIBLE,
      ...context,
    });
  }
}
