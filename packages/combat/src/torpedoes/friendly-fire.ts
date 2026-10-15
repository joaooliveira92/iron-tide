//packages/combat/src/torpedoes/friendly-fire.ts
// DESIGN-40 §24 friendly-fire danger sector (INC-3): pure, deterministic,
// INTEGER-only geometry. The launch danger sector is centred on the target
// bearing with half-angle = salvo spread half-angle + target-contact uncertainty
// angle. §24 PROHIBITS the launch when a CONFIRMED friendly contact is inside
// the sector with a predicted minimum separation below 1_000 m — and manual
// launch does NOT waive the prohibition. An UNIDENTIFIED or LOW-CONFIDENCE
// contact inside the sector raises the §10 minimum solution quality (7_500 bp,
// consumed by the eligibility fireSolutionQuality predicate via
// raisesMinimumSolutionQuality).
//
// Authored integer geometry (ENGINEERING-CONTRACT forbids floating-point for
// authoritative arithmetic; the small-angle approximations below are explicit
// authored constants, documented in constants.ts):
//   uncertaintyHalfAngleMdeg = floor(uncertaintyM * RAD_TO_MDEG / max(rangeM, 1))
//   dangerHalfAngleMdeg      = spreadHalfAngleMdeg + uncertaintyHalfAngleMdeg
//   minPredictedSeparationM  = floor(friendlyRangeM * bearingDiffMdeg / RAD_TO_MDEG)
//                              (cross-track distance of the friendly from the
//                              launch bearing line; 0 when dead on the line)
//
// Inputs are the firing side's RELATIVE knowledge (bearing/range/identity/
// confidence) — decoupled from absolute position math. The engine stage INC-7
// computes the relative friendly tracks from positions; this slice ships the
// pure assessment.
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

// A friendly-side contact the firing side can place relative to its own
// position: relative bearing (integer milli-degrees, full circle 360_000),
// estimated range (integer metres), estimated identity, and confidence (bp).
export interface FriendlyTrack {
  contactId: string;
  estimatedIdentity: string;
  relativeBearingMdeg: number;
  rangeM: number;
  confidenceBp: number;
}

export interface FriendlyFireRiskInputs {
  targetRelativeBearingMdeg: number; // integer milli-degrees (launch bearing line)
  targetEstimatedRangeM: number; // integer metres (uncertainty-angle denominator)
  solutionUncertaintyM: number; // integer metres (§9 target-contact uncertainty)
  spreadHalfAngleMdeg: number; // integer milli-degrees (salvo spread half-angle)
  friendlyTracks: readonly FriendlyTrack[]; // firing-side relative knowledge
  friendlyIdentities: readonly string[]; // confirmed-friendly estimated identities
  manualLaunch: boolean; // echoed into the verdict — NEVER waives §24
}

export interface FriendlyFireRiskAssessment {
  uncertaintyHalfAngleMdeg: number;
  dangerHalfAngleMdeg: number;
  tracksInDangerSector: readonly FriendlyTrack[];
  confirmedFriendlyInSector: boolean;
  unidentifiedOrLowConfidenceInSector: boolean;
  // §24 prohibition: a confirmed friendly inside the sector with a predicted
  // minimum separation below TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M.
  prohibited: boolean;
  // §10/§24 quality raise: any contact inside the sector that is confirmed
  // friendly, unidentified, or low-confidence -> 7_500 bp minimum.
  raisesMinimumSolutionQuality: boolean;
  manualLaunch: boolean; // echoed; the prohibition is never waived
}

// Shortest angular distance between two milli-degree bearings, with wraparound
// at ±180_000 mdeg (full circle = 360_000 mdeg).
function bearingDifferenceMdeg(aMdeg: number, bMdeg: number): number {
  let diff = Math.abs(aMdeg - bMdeg) % 360_000;
  if (diff > 180_000) diff = 360_000 - diff;
  return diff;
}

// Fail-closed input guard (mirrors assertEligibilityInputs in eligibility.ts):
// every geometry input is an integer, the friendly-track records are
// well-formed (non-empty ids, integer bearing, non-negative integer range,
// integer confidence within [0, 10_000]), identities are non-empty strings, and
// manualLaunch is a boolean. Runs before any geometry computation.
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

// AC-19: the pure §24 assessment. Never throws for well-formed inputs; every
// field is computed from the authored integer geometry above. Structurally
// invalid inputs (non-integer geometry, out-of-range confidence, malformed
// track/identity surfaces, non-boolean manualLaunch) fail closed with
// TORPEDO_STATE_INVARIANT_FAILED before any geometry — mirroring
// assertEligibilityInputs (eligibility.ts) so standalone callers (INC-7) get
// the same structured guard, never a raw TypeError.
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
    if (diffMdeg > dangerHalfAngleMdeg) continue; // outside the sector

    const confirmedFriendly = (inputs.friendlyIdentities as readonly string[]).includes(
      track.estimatedIdentity,
    );
    const unidentified = track.estimatedIdentity === UNIDENTIFIED_CONTACT_IDENTITY;
    const lowConfidence = track.confidenceBp < TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP;

    tracksInDangerSector.push(track);
    if (confirmedFriendly) confirmedFriendlyInSector = true;
    if (unidentified || lowConfidence) unidentifiedOrLowConfidenceInSector = true;

    // Minimum predicted separation = cross-track distance from the launch
    // bearing line (0 when the friendly sits on the line).
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
