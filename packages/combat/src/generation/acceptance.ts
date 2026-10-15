//packages/combat/src/generation/acceptance.ts
import { BluewaveError } from "@bluewave/contracts";
import type { BattleMissionType } from "./mission.js";
import { getMission } from "./mission.js";
import { BATTLE_DECLINE_NOT_ALLOWED } from "./reasonCodes.js";

// DESIGN-37 §34 acceptance classes.
export const ACCEPTANCE_CLASSES = [
  "OPTIONAL",
  "POLITICALLY_EXPECTED",
  "OPERATIONALLY_UNAVOIDABLE",
] as const;
export type AcceptanceClass = (typeof ACCEPTANCE_CLASSES)[number];

// DESIGN-37 §40 resolution modes.
export const RESOLUTION_MODES = ["TACTICAL_PLAY", "AUTO_RESOLVE"] as const;
export type ResolutionMode = (typeof RESOLUTION_MODES)[number];

// ADR B-1-4: headless decision policy.
export const HEADLESS_DECISION_POLICY_V1 = "headless_decision_policy_v1" as const;

// DESIGN-37 §39 mission classifications.
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

// ADR B-1-4: AUTO_RESOLVE when an automation policy exists (B10d precedent) or
// the battle is AI-only; otherwise the campaign holds pending (never silently
// declined or auto-resolved).
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
  // Missing player choice holds at the decision boundary (DESIGN-37 §40).
  return null;
}

export function assertDeclineAllowed(
  acceptanceClass: AcceptanceClass,
  context?: Record<string, unknown>,
): void {
  if (acceptanceClass === "OPERATIONALLY_UNAVOIDABLE") {
    throw new BluewaveError(BATTLE_DECLINE_NOT_ALLOWED, {
      code: BATTLE_DECLINE_NOT_ALLOWED,
      acceptanceClass,
      ...context,
    });
  }
}
