//packages/combat/src/generation/force.ts
import { BluewaveError } from "@bluewave/contracts";
import { BATTLE_FORCE_REQUIREMENT_MISSING, BATTLE_MANDATORY_ROLE_UNFILLED } from "./reasonCodes.js";
import type { BattleMissionType } from "./mission.js";
import { getMission, FLEET_BATTLE_MIN_STRENGTH, CRUISER_BATTLE_MIN_STRENGTH } from "./mission.js";

export type TacticalRole = "CORE" | "SUPPORT" | "SCOUT" | "SCREEN" | "PATROL" | "INDEPENDENT";

export interface BattleForceRequirementPolicy {
  policyId: string;
  missionType: BattleMissionType;
  mandatoryRoles: Record<string, TacticalRole[]>;
  optionalRoles: TacticalRole[];
  minEffectiveStrength: number;
  maxEffectiveStrength: number;
  policyVersion: string;
}

export function createForceRequirements(
  missionType: BattleMissionType,
): BattleForceRequirementPolicy {
  const def = getMission(missionType);
  const minStrength =
    missionType === "FLEET_BATTLE" ? FLEET_BATTLE_MIN_STRENGTH : CRUISER_BATTLE_MIN_STRENGTH;
  return {
    policyId: def.forceRequirementPolicyId,
    missionType,
    mandatoryRoles: { ATTACKER: ["CORE"], DEFENDER: ["CORE"] },
    optionalRoles: def.optionalRoles as TacticalRole[],
    minEffectiveStrength: minStrength,
    maxEffectiveStrength: Number.MAX_SAFE_INTEGER,
    policyVersion: "1",
  };
}

export interface MandatoryRoleCandidate {
  assetId: string;
  sideId: string;
  roleScore: number;
  effectiveStrength: number;
  readiness: number;
  commanderSuitability: number;
  assetIdentifier: string;
}

// DESIGN-37 §14: assign mandatory roles deterministically. Candidate ordering:
// role score → strength → readiness → commander suitability → identifier.
export function assignMandatoryRoles(
  candidates: MandatoryRoleCandidate[],
  _role: TacticalRole,
): { assetId: string; sideId: string } | undefined {
  const ordered = [...candidates].sort((a, b) => {
    if (b.roleScore !== a.roleScore) return b.roleScore - a.roleScore;
    if (b.effectiveStrength !== a.effectiveStrength)
      return b.effectiveStrength - a.effectiveStrength;
    if (b.readiness !== a.readiness) return b.readiness - a.readiness;
    if (b.commanderSuitability !== a.commanderSuitability)
      return b.commanderSuitability - a.commanderSuitability;
    return a.assetIdentifier.localeCompare(b.assetIdentifier);
  });
  return ordered[0];
}

export function assertForceRequirementsPresent(
  policy: BattleForceRequirementPolicy,
  context?: Record<string, unknown>,
): void {
  if (!policy || !policy.policyId) {
    throw new BluewaveError(BATTLE_FORCE_REQUIREMENT_MISSING, {
      code: BATTLE_FORCE_REQUIREMENT_MISSING,
      ...context,
    });
  }
}

export function assertMandatoryRoleFilled(
  role: TacticalRole,
  sideId: string,
  assignment: { assetId: string } | undefined,
  context?: Record<string, unknown>,
): void {
  if (!assignment) {
    throw new BluewaveError(BATTLE_MANDATORY_ROLE_UNFILLED, {
      code: BATTLE_MANDATORY_ROLE_UNFILLED,
      role,
      sideId,
      ...context,
    });
  }
}
