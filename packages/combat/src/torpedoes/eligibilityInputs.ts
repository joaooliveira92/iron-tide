// Fail-closed input validation for the DESIGN-40 §6 launch eligibility gate,
// split out of ./eligibility.js (which consumes it before any predicate runs).
import { BluewaveError } from "@bluewave/contracts";
import { TORPEDO_LAUNCH_KINDS } from "./constants.js";
import { validateTorpedoLauncherDefinition } from "./launcher.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import { assertFixedPointTorpedo } from "./state.js";
import type { LaunchEligibilityInputs } from "./eligibility.js";

// B-5 weather integer sea-state scale (weather/constants.ts SEA_STATE_MIN 0 ..
// SEA_STATE_MAX 9), mirrored locally so this gate stays decoupled from the B-5
// module while validating the same canonical bounds.
export const TORPEDO_SEA_STATE_MIN = 0 as const;
export const TORPEDO_SEA_STATE_MAX = 9 as const;

export function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

// Fail-closed input validation (ENGINEERING-CONTRACT: reject non-integers and
// unsafe integers at boundaries). Runs before any predicate.
export function assertEligibilityInputs(inputs: LaunchEligibilityInputs): void {
  const { state, definition } = inputs;
  assertFixedPointTorpedo(state);
  validateTorpedoLauncherDefinition(definition);
  if (state.launcherFamilyId !== definition.launcherFamilyId)
    invariant(
      "definition.launcherFamilyId",
      definition.launcherFamilyId,
      "launcher definition family must match the state's launcherFamilyId",
    );
  if (!Array.isArray(inputs.tubeIndexes) || inputs.tubeIndexes.length === 0)
    invariant("tubeIndexes", inputs.tubeIndexes, "a launch must select at least one tube");
  for (const idx of inputs.tubeIndexes) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= state.tubeCount)
      invariant(
        "tubeIndexes",
        inputs.tubeIndexes,
        `each tube index must be an integer within [0, ${state.tubeCount})`,
      );
  }
  // F4 mirror (consumeForLaunch): a tube may be fired at most once per launch —
  // duplicate indexes would double-count the same torpedo.
  if (new Set(inputs.tubeIndexes).size !== inputs.tubeIndexes.length)
    invariant(
      "tubeIndexes",
      inputs.tubeIndexes,
      "each tube may be fired at most once per launch (duplicate indexes)",
    );
  // Shape guards (mirror the numeric guards — structured fail-closed, never a
  // raw TypeError on a deserialized/mangled input surface).
  if (typeof inputs.contactId !== "string" || inputs.contactId.length === 0)
    invariant("contactId", inputs.contactId, "contactId must be a non-empty string");
  if (!(inputs.knownTracks instanceof Map) && !Array.isArray(inputs.knownTracks))
    invariant(
      "knownTracks",
      inputs.knownTracks,
      "knownTracks must be a Map or an array of contact tracks",
    );
  if (Array.isArray(inputs.knownTracks)) {
    for (const track of inputs.knownTracks) {
      if (typeof track !== "object" || track === null)
        invariant(
          "knownTracks",
          inputs.knownTracks,
          "every known track must be a contact-track record",
        );
    }
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
      track.confidenceBp > 10_000
    )
      invariant(
        "friendlyTracks.confidenceBp",
        track.confidenceBp,
        "friendly track confidence must be an integer basis points within [0, 10_000]",
      );
  }
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
  const setting = inputs.selectedSetting;
  if (typeof setting !== "object" || setting === null)
    invariant("selectedSetting", setting, "selectedSetting must be a speed/range setting record");
  if (typeof setting.settingId !== "string" || setting.settingId.length === 0)
    invariant(
      "selectedSetting.settingId",
      setting.settingId,
      "setting id must be a non-empty string",
    );
  if (!Number.isInteger(setting.speedMilliKnots) || setting.speedMilliKnots <= 0)
    invariant(
      "selectedSetting.speedMilliKnots",
      setting.speedMilliKnots,
      "setting speed must be a positive integer milli-knots",
    );
  if (!Number.isInteger(setting.rangeM) || setting.rangeM <= 0)
    invariant(
      "selectedSetting.rangeM",
      setting.rangeM,
      "setting range must be a positive integer metres",
    );
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
  if (
    !Number.isInteger(inputs.fireSolutionQualityBp) ||
    inputs.fireSolutionQualityBp < 0 ||
    inputs.fireSolutionQualityBp > 10_000
  )
    invariant(
      "fireSolutionQualityBp",
      inputs.fireSolutionQualityBp,
      "fire-solution quality must be an integer basis points within [0, 10_000]",
    );
  if (
    !Number.isInteger(inputs.ownSpeedMicrometresPerSecond) ||
    inputs.ownSpeedMicrometresPerSecond < 0
  )
    invariant(
      "ownSpeedMicrometresPerSecond",
      inputs.ownSpeedMicrometresPerSecond,
      "own speed must be a non-negative integer micrometres-per-second",
    );
  if (
    !Number.isInteger(inputs.seaState) ||
    inputs.seaState < TORPEDO_SEA_STATE_MIN ||
    inputs.seaState > TORPEDO_SEA_STATE_MAX
  )
    invariant(
      "seaState",
      inputs.seaState,
      `sea state must be an integer within [${TORPEDO_SEA_STATE_MIN}, ${TORPEDO_SEA_STATE_MAX}] (B-5 scale)`,
    );
  if (typeof inputs.ownManeuverWithinFireControlLimit !== "boolean")
    invariant(
      "ownManeuverWithinFireControlLimit",
      inputs.ownManeuverWithinFireControlLimit,
      "must be a boolean",
    );
  if (!(TORPEDO_LAUNCH_KINDS as readonly string[]).includes(inputs.launchKind))
    invariant("launchKind", inputs.launchKind, "launchKind must be a canonical §10 launch kind");
}
