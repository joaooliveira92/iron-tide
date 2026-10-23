import {
  EMPTY_TUBE,
  type TorpedoLaunchKind,
  TORPEDO_MAX_LAUNCH_SEA_STATE,
  TORPEDO_TARGET_CONTACT_MINIMUM_BP,
} from "./constants.js";
import {
  resolvedAboveWaterMaxLaunchSpeedKnots,
  type TorpedoLauncherDefinition,
} from "./launcher.js";
import {
  diameterFitsLauncher,
  fireControlSupportsModel,
  launcherFamilyMatches,
  massWithinLimits,
  propulsionAndSafetySupported,
} from "./compatibility.js";
import { type AuthorityGrant, validateLaunchAuthority } from "./authority.js";
import type { CompiledTorpedo, CompiledTorpedoSpeedSetting } from "@bluewave/armament";
import { compiledTorpedoOf, type CompiledTorpedoRegistry } from "./registry.js";
import {
  INVALID_TORPEDO_LAUNCHER_STATE,
  TORPEDO_AMMUNITION_UNAVAILABLE,
  TORPEDO_FIRE_SOLUTION_INSUFFICIENT,
  TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED,
  TORPEDO_LAUNCH_ARC_INVALID,
  TORPEDO_MODEL_INCOMPATIBLE,
  TORPEDO_TARGET_CONTACT_INSUFFICIENT,
  type TorpedoReasonCode,
  UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
} from "./reasonCodes.js";
import { type TorpedoLauncherState } from "./state.js";
import {
  validateAboveWaterLaunchSpeedLimit,
  validateUnderwaterTubeSpeedLimit,
} from "./launch-speed.js";
import { type ContactTrack, validateTargetOrder } from "../contact/neighbour.js";
import { solutionMeetsMinimum } from "./fire-solution.js";
import {
  assessFriendlyFireRisk,
  type FriendlyFireRiskAssessment,
  type FriendlyTrack,
} from "./friendly-fire.js";
import { assertEligibilityInputs, invariant } from "./eligibilityInputs.js";
export { TORPEDO_SEA_STATE_MAX, TORPEDO_SEA_STATE_MIN } from "./eligibilityInputs.js";

export type TorpedoEligibilityPredicate =
  | "authority"
  | "launcherAndTubesOperational"
  | "compatibleTorpedoesLoaded"
  | "reloadAndSafetyInterlocks"
  | "targetContactConfidence"
  | "targetNotFriendly"
  | "launchArc"
  | "rangeWithinSetting"
  | "armingDistanceSatisfiable"
  | "fireSolutionQuality"
  | "ownSpeedWithinLauncherLimits"
  | "ownManeuverWithinFireControlLimit"
  | "seaStatePermitsLaunch"
  | "friendlyFireSafety"
  | "ammunitionReservation";

export type EligibilityPredicateResult = boolean;

export interface LaunchEligibilityVerdict {
  eligible: boolean;
  predicateResults: Record<TorpedoEligibilityPredicate, EligibilityPredicateResult>;
  failingPredicate: TorpedoEligibilityPredicate | null;
  reasonCode: TorpedoReasonCode | null;
  consumedTorpedo: false;
}

export interface LaunchEligibilityInputs {
  state: TorpedoLauncherState;
  definition: TorpedoLauncherDefinition;
  tubeIndexes: readonly number[];
  authorityGrant: AuthorityGrant | null | undefined;
  manualLaunch: boolean;
  contactId: string;
  knownTracks: Map<string, ContactTrack> | ContactTrack[];
  friendlyIdentities: readonly string[];
  targetRelativeBearingMdeg: number;
  targetEstimatedRangeM: number;
  selectedSetting: CompiledTorpedoSpeedSetting;
  torpedoes: CompiledTorpedoRegistry;
  launchKind: TorpedoLaunchKind;
  fireSolutionQualityBp: number;
  ownSpeedMicrometresPerSecond: number;
  ownManeuverWithinFireControlLimit: boolean;
  seaState: number;
  friendlyTracks: readonly FriendlyTrack[];
  solutionUncertaintyM: number;
  spreadHalfAngleMdeg: number;
}

export function launcherAndTubesOperational(state: TorpedoLauncherState): boolean {
  return state.damageState === "OPERATIONAL";
}

export function tubesCarryCompatibleTorpedoes(
  state: TorpedoLauncherState,
  definition: TorpedoLauncherDefinition,
  tubeIndexes: readonly number[],
  torpedoes: CompiledTorpedoRegistry,
): boolean {
  for (const idx of tubeIndexes) {
    const loaded = state.loadedPerTube[idx];
    if (loaded === EMPTY_TUBE || typeof loaded !== "string" || loaded.length === 0) return false;
    const model = compiledTorpedoOf(torpedoes, loaded);
    if (!launcherFamilyMatches(model, definition)) return false;
    if (!diameterFitsLauncher(model, definition)) return false;
    if (!massWithinLimits(model, definition)) return false;
    if (!propulsionAndSafetySupported(model, definition)) return false;
    if (!fireControlSupportsModel(model, definition)) return false;
  }
  return true;
}

export function loadedModelsForTubes(
  state: TorpedoLauncherState,
  tubeIndexes: readonly number[],
  torpedoes: CompiledTorpedoRegistry,
): CompiledTorpedo[] {
  const models: CompiledTorpedo[] = [];
  for (const idx of tubeIndexes) {
    const loaded = state.loadedPerTube[idx];
    if (loaded === EMPTY_TUBE || typeof loaded !== "string" || loaded.length === 0)
      invariant("loadedPerTube", loaded, "a selected tube must be loaded for eligibility");
    models.push(compiledTorpedoOf(torpedoes, loaded));
  }
  return models;
}

export function reloadAndSafetyInterlocksComplete(state: TorpedoLauncherState): boolean {
  if (state.reloadState.status !== "NO_RELOAD_IN_PROGRESS") return false;
  if (state.fireControlConnectionState !== "CONNECTED") return false;
  if (state.floodingIsolationState === "FAILED") return false;
  return true;
}

export function targetContactConfidenceSufficient(track: ContactTrack): boolean {
  return track.confidence >= TORPEDO_TARGET_CONTACT_MINIMUM_BP;
}

export function targetNotIdentifiedFriendly(
  track: ContactTrack,
  friendlyIdentities: readonly string[],
): boolean {
  return !(friendlyIdentities as readonly string[]).includes(track.estimatedIdentity);
}

export function targetWithinLaunchArc(
  state: TorpedoLauncherState,
  targetRelativeBearingMdeg: number,
): boolean {
  return (
    targetRelativeBearingMdeg >= state.trainingLimitsMdeg.min &&
    targetRelativeBearingMdeg <= state.trainingLimitsMdeg.max
  );
}

export function targetRangeWithinSetting(
  targetEstimatedRangeM: number,
  selectedSetting: CompiledTorpedoSpeedSetting,
): boolean {
  return targetEstimatedRangeM <= selectedSetting.rangeM;
}

export function armingDistanceSatisfiable(
  targetEstimatedRangeM: number,
  models: readonly CompiledTorpedo[],
): boolean {
  const bindingArmingM = models.reduce((max, m) => Math.max(max, m.minimumArmingDistanceM), 0);
  return targetEstimatedRangeM >= bindingArmingM;
}

export function fireSolutionQualitySufficient(
  fireSolutionQualityBp: number,
  launchKind: TorpedoLaunchKind,
  friendlyInDangerSector: boolean = false,
): boolean {
  return solutionMeetsMinimum(fireSolutionQualityBp, launchKind, friendlyInDangerSector);
}

export function ownSpeedWithinLauncherLimits(
  state: TorpedoLauncherState,
  definition: TorpedoLauncherDefinition,
  ownSpeedMicrometresPerSecond: number,
): { passes: boolean; reasonCode: TorpedoReasonCode | null } {
  if (state.mountType === "UNDERWATER_FIXED" || state.mountType === "UNDERWATER_TRAINABLE") {
    const verdict = validateUnderwaterTubeSpeedLimit(ownSpeedMicrometresPerSecond, state.mountType);
    if (!verdict.allowed)
      return { passes: false, reasonCode: UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED };
    return { passes: true, reasonCode: null };
  }
  if (state.mountType === "ABOVE_WATER_FIXED" || state.mountType === "ABOVE_WATER_TRAINABLE") {
    const verdict = validateAboveWaterLaunchSpeedLimit(
      ownSpeedMicrometresPerSecond,
      resolvedAboveWaterMaxLaunchSpeedKnots(definition),
    );
    if (!verdict.allowed) return { passes: false, reasonCode: verdict.reasonCode };
    return { passes: true, reasonCode: null };
  }
  return { passes: true, reasonCode: null };
}

export function seaStatePermitsLaunch(seaState: number): boolean {
  return seaState <= TORPEDO_MAX_LAUNCH_SEA_STATE;
}

export function ammunitionReservationSucceeds(
  state: TorpedoLauncherState,
  tubeIndexes: readonly number[],
): boolean {
  return tubeIndexes.every((idx) => {
    const loaded = state.loadedPerTube[idx];
    return loaded !== EMPTY_TUBE && typeof loaded === "string" && loaded.length > 0;
  });
}

export function friendlyFireSafetyVerdict(assessment: FriendlyFireRiskAssessment): boolean {
  return !assessment.prohibited;
}

export function evaluateLaunchEligibility(
  inputs: LaunchEligibilityInputs,
): LaunchEligibilityVerdict {
  assertEligibilityInputs(inputs);
  const { state, definition, tubeIndexes, launchKind } = inputs;

  const authorityVerdict = validateLaunchAuthority(inputs.authorityGrant, inputs.manualLaunch);
  if (!authorityVerdict.allowed) {
    return {
      eligible: false,
      predicateResults: {
        authority: false,
        launcherAndTubesOperational: true,
        compatibleTorpedoesLoaded: true,
        reloadAndSafetyInterlocks: true,
        targetContactConfidence: true,
        targetNotFriendly: true,
        launchArc: true,
        rangeWithinSetting: true,
        armingDistanceSatisfiable: true,
        fireSolutionQuality: true,
        ownSpeedWithinLauncherLimits: true,
        ownManeuverWithinFireControlLimit: true,
        seaStatePermitsLaunch: true,
        friendlyFireSafety: true,
        ammunitionReservation: true,
      },
      failingPredicate: "authority",
      reasonCode: authorityVerdict.reasonCode as TorpedoReasonCode,
      consumedTorpedo: false,
    };
  }

  const results: Record<TorpedoEligibilityPredicate, EligibilityPredicateResult> = {
    authority: true,
    launcherAndTubesOperational: true,
    compatibleTorpedoesLoaded: true,
    reloadAndSafetyInterlocks: true,
    targetContactConfidence: true,
    targetNotFriendly: true,
    launchArc: true,
    rangeWithinSetting: true,
    armingDistanceSatisfiable: true,
    fireSolutionQuality: true,
    ownSpeedWithinLauncherLimits: true,
    ownManeuverWithinFireControlLimit: true,
    seaStatePermitsLaunch: true,
    friendlyFireSafety: true,
    ammunitionReservation: true,
  };

  const fail = (
    failingPredicate: TorpedoEligibilityPredicate,
    reasonCode: TorpedoReasonCode,
    failedResults: Partial<Record<TorpedoEligibilityPredicate, EligibilityPredicateResult>>,
  ): LaunchEligibilityVerdict => ({
    eligible: false,
    predicateResults: { ...results, ...failedResults },
    failingPredicate,
    reasonCode,
    consumedTorpedo: false,
  });

  if (!launcherAndTubesOperational(state)) {
    return fail("launcherAndTubesOperational", INVALID_TORPEDO_LAUNCHER_STATE, {
      launcherAndTubesOperational: false,
    });
  }

  if (!ammunitionReservationSucceeds(state, tubeIndexes)) {
    return fail("compatibleTorpedoesLoaded", TORPEDO_AMMUNITION_UNAVAILABLE, {
      compatibleTorpedoesLoaded: false,
      ammunitionReservation: false,
    });
  }
  if (!tubesCarryCompatibleTorpedoes(state, definition, tubeIndexes, inputs.torpedoes)) {
    return fail("compatibleTorpedoesLoaded", TORPEDO_MODEL_INCOMPATIBLE, {
      compatibleTorpedoesLoaded: false,
    });
  }
  const models = loadedModelsForTubes(state, tubeIndexes, inputs.torpedoes);

  if (!reloadAndSafetyInterlocksComplete(state)) {
    return fail("reloadAndSafetyInterlocks", INVALID_TORPEDO_LAUNCHER_STATE, {
      reloadAndSafetyInterlocks: false,
    });
  }

  const track = validateTargetOrder(inputs.contactId, inputs.knownTracks);
  if (!targetContactConfidenceSufficient(track)) {
    return fail("targetContactConfidence", TORPEDO_TARGET_CONTACT_INSUFFICIENT, {
      targetContactConfidence: false,
    });
  }

  const friendlyFire = assessFriendlyFireRisk({
    targetRelativeBearingMdeg: inputs.targetRelativeBearingMdeg,
    targetEstimatedRangeM: inputs.targetEstimatedRangeM,
    solutionUncertaintyM: inputs.solutionUncertaintyM,
    spreadHalfAngleMdeg: inputs.spreadHalfAngleMdeg,
    friendlyTracks: inputs.friendlyTracks,
    friendlyIdentities: inputs.friendlyIdentities,
    manualLaunch: inputs.manualLaunch,
  });

  if (!targetNotIdentifiedFriendly(track, inputs.friendlyIdentities)) {
    return fail("targetNotFriendly", TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED, {
      targetNotFriendly: false,
    });
  }

  if (!targetWithinLaunchArc(state, inputs.targetRelativeBearingMdeg)) {
    return fail("launchArc", TORPEDO_LAUNCH_ARC_INVALID, { launchArc: false });
  }

  if (!targetRangeWithinSetting(inputs.targetEstimatedRangeM, inputs.selectedSetting)) {
    return fail("rangeWithinSetting", TORPEDO_TARGET_CONTACT_INSUFFICIENT, {
      rangeWithinSetting: false,
    });
  }

  if (!armingDistanceSatisfiable(inputs.targetEstimatedRangeM, models)) {
    return fail("armingDistanceSatisfiable", TORPEDO_TARGET_CONTACT_INSUFFICIENT, {
      armingDistanceSatisfiable: false,
    });
  }

  if (
    !fireSolutionQualitySufficient(
      inputs.fireSolutionQualityBp,
      launchKind,
      friendlyFire.raisesMinimumSolutionQuality,
    )
  ) {
    return fail("fireSolutionQuality", TORPEDO_FIRE_SOLUTION_INSUFFICIENT, {
      fireSolutionQuality: false,
    });
  }

  const speed = ownSpeedWithinLauncherLimits(
    state,
    definition,
    inputs.ownSpeedMicrometresPerSecond,
  );
  if (!speed.passes) {
    return fail(
      "ownSpeedWithinLauncherLimits",
      speed.reasonCode ?? UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
      { ownSpeedWithinLauncherLimits: false },
    );
  }

  if (!inputs.ownManeuverWithinFireControlLimit) {
    return fail("ownManeuverWithinFireControlLimit", TORPEDO_FIRE_SOLUTION_INSUFFICIENT, {
      ownManeuverWithinFireControlLimit: false,
    });
  }

  if (!seaStatePermitsLaunch(inputs.seaState)) {
    return fail("seaStatePermitsLaunch", TORPEDO_FIRE_SOLUTION_INSUFFICIENT, {
      seaStatePermitsLaunch: false,
    });
  }

  if (!friendlyFireSafetyVerdict(friendlyFire)) {
    return fail("friendlyFireSafety", TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED, {
      friendlyFireSafety: false,
    });
  }

  return {
    eligible: true,
    predicateResults: results,
    failingPredicate: null,
    reasonCode: null,
    consumedTorpedo: false,
  };
}
