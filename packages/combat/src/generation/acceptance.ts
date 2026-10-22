import { BluewaveError } from "@bluewave/contracts";
import type { BattleMissionType } from "./mission.js";
import { getMission } from "./mission.js";
import { BATTLE_DECLINE_NOT_ALLOWED } from "./reasonCodes.js";

export const ACCEPTANCE_CLASSES = [
  "OPTIONAL",
  "POLITICALLY_EXPECTED",
  "OPERATIONALLY_UNAVOIDABLE",
] as const;
export type AcceptanceClass = (typeof ACCEPTANCE_CLASSES)[number];

export const RESOLUTION_MODES = ["TACTICAL_PLAY", "AUTO_RESOLVE"] as const;
export type ResolutionMode = (typeof RESOLUTION_MODES)[number];

export const HEADLESS_DECISION_POLICY_V1 = "headless_decision_policy_v1" as const;

export function missionAcceptanceClass(missionType: BattleMissionType): AcceptanceClass {
  const def = getMission(missionType);
  return def.acceptanceClass as AcceptanceClass;
}

export interface BattleDecisionBoundary {
  opportunityId: string;
  acceptanceClass: AcceptanceClass;
  resolutionMode: ResolutionMode;
  automationPolicyId: string | null;
}

export function resolveDecisionBoundary(
  opp: { acceptanceClass: string; hasAutomationPolicy: boolean; isAiOnly: boolean },
  _context?: Record<string, unknown>,
): BattleDecisionBoundary | null {
  if (opp.hasAutomationPolicy || opp.isAiOnly) {
    return {
      opportunityId: opp.acceptanceClass,
      acceptanceClass: opp.acceptanceClass as AcceptanceClass,
      resolutionMode: "AUTO_RESOLVE",
      automationPolicyId: HEADLESS_DECISION_POLICY_V1,
    };
  }
  return null;
}

export function isDeclineAllowed(acceptanceClass: AcceptanceClass): boolean {
  return acceptanceClass !== "OPERATIONALLY_UNAVOIDABLE";
}

export function assertDeclineAllowed(
  acceptanceClass: AcceptanceClass,
  context?: Record<string, unknown>,
): void {
  if (!isDeclineAllowed(acceptanceClass)) {
    throw new BluewaveError(BATTLE_DECLINE_NOT_ALLOWED, {
      code: BATTLE_DECLINE_NOT_ALLOWED,
      acceptanceClass,
      ...context,
    });
  }
}
