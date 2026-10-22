import { BluewaveError } from "@bluewave/contracts";
import {
  TORPEDO_DANGER_SECTOR_RAD_TO_MDEG,
  TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP,
  TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M,
  TORPEDO_SOLUTION_FINAL_MAX_BP,
  UNIDENTIFIED_CONTACT_IDENTITY,
} from "./constants.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export interface FriendlyTrack {
  contactId: string;
  estimatedIdentity: string;
  relativeBearingMdeg: number;
  rangeM: number;
  confidenceBp: number;
}

export interface FriendlyFireRiskInputs {
  targetRelativeBearingMdeg: number;
  targetEstimatedRangeM: number;
  solutionUncertaintyM: number;
  spreadHalfAngleMdeg: number;
  friendlyTracks: readonly FriendlyTrack[];
  friendlyIdentities: readonly string[];
  manualLaunch: boolean;
}

export interface FriendlyFireRiskAssessment {
  uncertaintyHalfAngleMdeg: number;
  dangerHalfAngleMdeg: number;
  tracksInDangerSector: readonly FriendlyTrack[];
  confirmedFriendlyInSector: boolean;
  unidentifiedOrLowConfidenceInSector: boolean;
  prohibited: boolean;
  raisesMinimumSolutionQuality: boolean;
  manualLaunch: boolean;
}

function bearingDifferenceMdeg(aMdeg: number, bMdeg: number): number {
  let diff = Math.abs(aMdeg - bMdeg) % 360_000;
  if (diff > 180_000) diff = 360_000 - diff;
  return diff;
}

function assertFriendlyFireInputs(inputs: FriendlyFireRiskInputs): void {
  if (!Number.isInteger(inputs.targetRelativeBearingMdeg))
    invariant(
      "targetRelativeBearingMdeg",
      inputs.targetRelativeBearingMdeg,
      "target relative bearing must be an integer milli-degrees",
    );
  if (!Number.isInteger(inputs.targetEstimatedRangeM) || inputs.targetEstimatedRangeM < 0)
    invariant(
      "targetEstimatedRangeM",
      inputs.targetEstimatedRangeM,
      "target estimated range must be a non-negative integer metres",
    );
  if (!Number.isInteger(inputs.solutionUncertaintyM) || inputs.solutionUncertaintyM < 0)
    invariant(
      "solutionUncertaintyM",
      inputs.solutionUncertaintyM,
      "solution uncertainty must be a non-negative integer metres",
    );
  if (!Number.isInteger(inputs.spreadHalfAngleMdeg) || inputs.spreadHalfAngleMdeg < 0)
    invariant(
      "spreadHalfAngleMdeg",
      inputs.spreadHalfAngleMdeg,
      "spread half-angle must be a non-negative integer milli-degrees",
    );
  if (!Array.isArray(inputs.friendlyTracks))
    invariant(
      "friendlyTracks",
      inputs.friendlyTracks,
      "friendlyTracks must be an array of relative friendly tracks",
    );
  for (const track of inputs.friendlyTracks) {
    if (typeof track !== "object" || track === null)
      invariant("friendlyTracks", inputs.friendlyTracks, "every friendly track must be a record");
    if (typeof track.contactId !== "string" || track.contactId.length === 0)
      invariant(
        "friendlyTracks.contactId",
        track.contactId,
        "every friendly track needs a non-empty contact id",
      );
    if (typeof track.estimatedIdentity !== "string" || track.estimatedIdentity.length === 0)
      invariant(
        "friendlyTracks.estimatedIdentity",
        track.estimatedIdentity,
        "every friendly track needs a non-empty estimated identity",
      );
    if (!Number.isInteger(track.relativeBearingMdeg))
      invariant(
        "friendlyTracks.relativeBearingMdeg",
        track.relativeBearingMdeg,
        "friendly track bearing must be an integer milli-degrees",
      );
    if (!Number.isInteger(track.rangeM) || track.rangeM < 0)
      invariant(
        "friendlyTracks.rangeM",
        track.rangeM,
        "friendly track range must be a non-negative integer metres",
      );
    if (
      !Number.isInteger(track.confidenceBp) ||
      track.confidenceBp < 0 ||
      track.confidenceBp > TORPEDO_SOLUTION_FINAL_MAX_BP
    )
      invariant(
        "friendlyTracks.confidenceBp",
        track.confidenceBp,
        `friendly track confidence must be an integer basis points within [0, ${TORPEDO_SOLUTION_FINAL_MAX_BP}]`,
      );
  }
  if (!Array.isArray(inputs.friendlyIdentities))
    invariant(
      "friendlyIdentities",
      inputs.friendlyIdentities,
      "friendlyIdentities must be an array of identity ids",
    );
  for (const id of inputs.friendlyIdentities) {
    if (typeof id !== "string" || id.length === 0)
      invariant(
        "friendlyIdentities",
        inputs.friendlyIdentities,
        "every friendly identity must be a non-empty string",
      );
  }
  if (typeof inputs.manualLaunch !== "boolean")
    invariant("manualLaunch", inputs.manualLaunch, "manualLaunch must be a boolean");
}

export function assessFriendlyFireRisk(inputs: FriendlyFireRiskInputs): FriendlyFireRiskAssessment {
  assertFriendlyFireInputs(inputs);
  const uncertaintyHalfAngleMdeg = Math.floor(
    (inputs.solutionUncertaintyM * TORPEDO_DANGER_SECTOR_RAD_TO_MDEG) /
      Math.max(inputs.targetEstimatedRangeM, 1),
  );
  const dangerHalfAngleMdeg = inputs.spreadHalfAngleMdeg + uncertaintyHalfAngleMdeg;

  const tracksInDangerSector: FriendlyTrack[] = [];
  let confirmedFriendlyInSector = false;
  let unidentifiedOrLowConfidenceInSector = false;
  let prohibited = false;
  let raisesMinimumSolutionQuality = false;

  for (const track of inputs.friendlyTracks) {
    const diffMdeg = bearingDifferenceMdeg(
      inputs.targetRelativeBearingMdeg,
      track.relativeBearingMdeg,
    );
    if (diffMdeg > dangerHalfAngleMdeg) continue;

    const confirmedFriendly = (inputs.friendlyIdentities as readonly string[]).includes(
      track.estimatedIdentity,
    );
    const unidentified = track.estimatedIdentity === UNIDENTIFIED_CONTACT_IDENTITY;
    const lowConfidence = track.confidenceBp < TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP;

    tracksInDangerSector.push(track);
    if (confirmedFriendly) confirmedFriendlyInSector = true;
    if (unidentified || lowConfidence) unidentifiedOrLowConfidenceInSector = true;

    const predictedSeparationM = Math.floor(
      (track.rangeM * diffMdeg) / TORPEDO_DANGER_SECTOR_RAD_TO_MDEG,
    );
    if (confirmedFriendly && predictedSeparationM < TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M) {
      prohibited = true;
    }
    if (confirmedFriendly || unidentified || lowConfidence) {
      raisesMinimumSolutionQuality = true;
    }
  }

  return {
    uncertaintyHalfAngleMdeg,
    dangerHalfAngleMdeg,
    tracksInDangerSector,
    confirmedFriendlyInSector,
    unidentifiedOrLowConfidenceInSector,
    prohibited,
    raisesMinimumSolutionQuality,
    manualLaunch: inputs.manualLaunch,
  };
}
