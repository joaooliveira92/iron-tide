import { BluewaveError } from "@bluewave/contracts";
export const AUTO_RESOLUTION_THRESHOLDS = {
  meanRelativeError: 0.1,
  lossRateDiffPp: 10,
  missionSuccessDiffPp: 10,
  sideBiasPp: 5,
  minPairedRuns: 1_000,
} as const;

export function assertAutoResolvable(manifest: {
  id: string;
  accepted: boolean;
  requiresTacticalCommandForContinuity?: boolean;
}) {
  if (!manifest.accepted)
    throw new BluewaveError("AUTO_RESOLUTION_UNAVAILABLE", {
      code: "AUTO_RESOLUTION_UNAVAILABLE",
      manifest,
    });
}
export function validateStatisticalReport(r: {
  scenario: string;
  rulesetVersion: string;
  formulaVersion: string;
  aiPolicyVersion: string;
  rngVersion: string;
  pairedRuns: number;
  meanRelativeError: number;
  lossRateDiffPp: number;
  missionSuccessDiffPp: number;
  sideBiasPp: number;
}) {
  if (
    r.pairedRuns < 1_000 ||
    r.meanRelativeError > 0.1 ||
    r.lossRateDiffPp > 10 ||
    r.missionSuccessDiffPp > 10 ||
    r.sideBiasPp > 5
  )
    throw new BluewaveError("AUTO_RESOLUTION_VALIDATION_FAILED", {
      code: "AUTO_RESOLUTION_VALIDATION_FAILED",
      r,
    });
  if (!r.scenario || !r.rulesetVersion || !r.formulaVersion || !r.aiPolicyVersion || !r.rngVersion)
    throw new BluewaveError("AUTO_RESOLUTION_VALIDATION_FAILED: missing pinned versions", {
      code: "AUTO_RESOLUTION_VALIDATION_FAILED",
      r,
    });
}
