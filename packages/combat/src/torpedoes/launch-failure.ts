import { BluewaveError } from "@bluewave/contracts";
import {
  TORPEDO_BASIS_POINTS_PER_UNIT,
  TORPEDO_LAUNCH_FAILURE_BASE_BP,
  TORPEDO_LAUNCH_FAILURE_CREW_ADJUSTMENT_DIVISOR,
  TORPEDO_LAUNCH_FAILURE_CREW_NEUTRAL_BP,
  TORPEDO_LAUNCH_FAILURE_DAMAGE_ADJUSTMENT_BP,
  TORPEDO_LAUNCH_FAILURE_MAX_BP,
  TORPEDO_LAUNCH_FAILURE_MIN_BP,
  TORPEDO_LAUNCH_FAILURE_MODEL_RELIABILITY_DIVISOR,
  TORPEDO_LAUNCH_FAILURE_RELIABILITY_BAND_TABLE,
  TORPEDO_LAUNCH_SUBSTEP,
  TORPEDO_RELIABILITY_SCALE,
  TORPEDO_STUCK_IN_TUBE_SHARE_BP,
  type LauncherDamageState,
} from "./constants.js";
import type { CompiledTorpedoSpeedSetting } from "@bluewave/armament";
import { compiledTorpedoOf, type CompiledTorpedoRegistry } from "./registry.js";
import {
  TORPEDO_LAUNCH_FAILURE,
  TORPEDO_STATE_INVARIANT_FAILED,
  TORPEDO_STUCK_IN_TUBE,
  type TorpedoReasonCode,
} from "./reasonCodes.js";
import { recommendSalvoSize, type TorpedoSalvoPolicyInputs } from "./salvo.js";
import type { TorpedoConsumeResult } from "./ammunition.js";
import { type TorpedoLauncherState, withTorpedoLauncherStateHash } from "./state.js";
import { createTorpedoTrack, type TorpedoTrack } from "./track.js";
import type { Position } from "../spotting/detection.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export type TorpedoTubeLaunchOutcome =
  | "SUCCESS"
  | "TORPEDO_STUCK_IN_TUBE"
  | "TORPEDO_LAUNCH_FAILURE";

export interface TorpedoTubeLaunchAttempt {
  tubeId: number;
  firingSubstep: number;
  outcome: TorpedoTubeLaunchOutcome;
  reasonCode: TorpedoReasonCode | null;
  failureChanceBp: number;
  stuckBoundaryBp: number;
  drawBp: number;
  drawStreamId: string;
}

export interface TorpedoLaunchResolution {
  state: TorpedoLauncherState;
  attempts: readonly TorpedoTubeLaunchAttempt[];
  skippedTubeIds: readonly number[];
  tracks: readonly TorpedoTrack[];
  salvo: {
    recommendedSize: number;
    scoreBp: number;
  };
}

export interface TorpedoLaunchModifierInputs {
  launcherDamageState: LauncherDamageState;
  modelReliabilityBp: number;
  crewQualityBp: number;
}

export function torpedoLaunchFailureStreamId(o: {
  battleId: string;
  launchMinute: number;
  firingSubstep: number;
  launcherId: string;
  tubeId: number;
}): string {
  return `battle/ship/torpedo/launch_failure:${o.battleId}:${o.launchMinute}:${o.firingSubstep}:${o.launcherId}:tube${o.tubeId}`;
}

export function computeLaunchFailureChanceBp(input: TorpedoLaunchModifierInputs): number {
  if (
    !Number.isInteger(input.crewQualityBp) ||
    input.crewQualityBp < 0 ||
    input.crewQualityBp > TORPEDO_BASIS_POINTS_PER_UNIT
  )
    invariant(
      "crewQualityBp",
      input.crewQualityBp,
      `crew quality must be an integer basis point within [0, ${TORPEDO_BASIS_POINTS_PER_UNIT}]`,
    );
  if (!Number.isInteger(input.modelReliabilityBp) || input.modelReliabilityBp < 0)
    invariant(
      "modelReliabilityBp",
      input.modelReliabilityBp,
      "model reliability must be a non-negative integer",
    );
  if (input.modelReliabilityBp > TORPEDO_RELIABILITY_SCALE)
    invariant(
      "modelReliabilityBp",
      input.modelReliabilityBp,
      `model reliability must be within [0, ${TORPEDO_RELIABILITY_SCALE}]`,
    );
  if (input.launcherDamageState === "DESTROYED")
    invariant(
      "launcherDamageState",
      input.launcherDamageState,
      "a DESTROYED launcher never launches (the resolver fails closed defensively)",
    );

  const modelAdjustment = Math.floor(
    (TORPEDO_RELIABILITY_SCALE - input.modelReliabilityBp) /
      TORPEDO_LAUNCH_FAILURE_MODEL_RELIABILITY_DIVISOR,
  );
  const damageAdjustment = TORPEDO_LAUNCH_FAILURE_DAMAGE_ADJUSTMENT_BP[input.launcherDamageState];
  const crewAdjustment = Math.floor(
    (TORPEDO_LAUNCH_FAILURE_CREW_NEUTRAL_BP - input.crewQualityBp) /
      TORPEDO_LAUNCH_FAILURE_CREW_ADJUSTMENT_DIVISOR,
  );
  let bandAdjustment = 0;
  for (const band of TORPEDO_LAUNCH_FAILURE_RELIABILITY_BAND_TABLE) {
    if (input.modelReliabilityBp >= band.minReliabilityBp) {
      bandAdjustment = band.adjustmentBp;
      break;
    }
  }

  const raw =
    TORPEDO_LAUNCH_FAILURE_BASE_BP +
    modelAdjustment +
    damageAdjustment +
    crewAdjustment +
    bandAdjustment;
  return Math.min(TORPEDO_LAUNCH_FAILURE_MAX_BP, Math.max(TORPEDO_LAUNCH_FAILURE_MIN_BP, raw));
}

export function evaluateTubeLaunchDraw(o: {
  failureChanceBp: number;
  draw: number;
  stuckShareBp?: number;
}): { outcome: TorpedoTubeLaunchOutcome; drawBp: number; stuckBoundaryBp: number } {
  const stuckShare = o.stuckShareBp ?? TORPEDO_STUCK_IN_TUBE_SHARE_BP;
  if (!Number.isInteger(o.failureChanceBp) || o.failureChanceBp < 0)
    invariant(
      "failureChanceBp",
      o.failureChanceBp,
      "failure chance must be a non-negative integer",
    );
  if (typeof o.draw !== "number" || o.draw < 0 || o.draw >= 1)
    invariant("draw", o.draw, "the keyed draw must be a float within [0, 1)");
  if (!Number.isInteger(stuckShare) || stuckShare < 0 || stuckShare > TORPEDO_BASIS_POINTS_PER_UNIT)
    invariant(
      "stuckShareBp",
      stuckShare,
      `stuck share must be an integer basis point within [0, ${TORPEDO_BASIS_POINTS_PER_UNIT}]`,
    );
  const drawBp = Math.floor(o.draw * TORPEDO_BASIS_POINTS_PER_UNIT);
  const stuckBoundaryBp = Math.floor(
    (o.failureChanceBp * stuckShare) / TORPEDO_BASIS_POINTS_PER_UNIT,
  );
  if (drawBp >= o.failureChanceBp) return { outcome: "SUCCESS", drawBp, stuckBoundaryBp };
  if (drawBp < stuckBoundaryBp)
    return { outcome: "TORPEDO_STUCK_IN_TUBE", drawBp, stuckBoundaryBp };
  return { outcome: "TORPEDO_LAUNCH_FAILURE", drawBp, stuckBoundaryBp };
}

export function salvoContinuesAfterFailure(o: {
  salvoPolicy: TorpedoSalvoPolicyInputs;
  acceptedTubeCount: number;
  successfulLaunchesSoFar: number;
}): boolean {
  const rec = recommendSalvoSize(o.salvoPolicy, o.acceptedTubeCount);
  return o.successfulLaunchesSoFar < rec.recommendedSize;
}

export function resolveTubeLaunches(o: {
  battleId: string;
  firingShipId: string;
  firingSideId: string;
  reservation: TorpedoConsumeResult;
  tubeIndexes: readonly number[];
  torpedoes: CompiledTorpedoRegistry;
  crewQualityBp: number;
  salvoPolicy: TorpedoSalvoPolicyInputs;
  selectedSetting: CompiledTorpedoSpeedSetting;
  launchMinute: number;
  firingSubstep?: number;
  launchPosition: Position;
  launchHeadingMdeg: number;
  orderedGyroAngleMdeg: number;
  depthSettingM: number;
  targetContactId: string | null;
  keyedRng: (stream: string) => number;
}): TorpedoLaunchResolution {
  if (typeof o.battleId !== "string" || o.battleId.length === 0)
    invariant("battleId", o.battleId, "battleId must be a non-empty string");
  if (typeof o.firingShipId !== "string" || o.firingShipId.length === 0)
    invariant("firingShipId", o.firingShipId, "firingShipId must be a non-empty string");
  if (typeof o.firingSideId !== "string" || o.firingSideId.length === 0)
    invariant("firingSideId", o.firingSideId, "firingSideId must be a non-empty string");
  if (!Array.isArray(o.tubeIndexes) || o.tubeIndexes.length === 0)
    invariant("tubeIndexes", o.tubeIndexes, "an accepted salvo must fire at least one tube");
  if (!Number.isInteger(o.launchMinute) || o.launchMinute < 0)
    invariant("launchMinute", o.launchMinute, "launch minute must be a non-negative integer");
  const firingSubstep = o.firingSubstep ?? TORPEDO_LAUNCH_SUBSTEP;
  if (!Number.isInteger(firingSubstep) || firingSubstep < 1)
    invariant("firingSubstep", firingSubstep, "firing substep must be a positive integer");
  if (typeof o.keyedRng !== "function")
    invariant("keyedRng", o.keyedRng, "a deterministic keyed RNG stream function is required");

  const fireOrder = [...o.tubeIndexes].sort((a, b) => a - b);
  if (!fireOrder.every((t) => Number.isInteger(t) && t >= 0))
    invariant("tubeIndexes", o.tubeIndexes, "every tube id must be a non-negative integer");
  if (new Set(fireOrder).size !== fireOrder.length)
    invariant("tubeIndexes", o.tubeIndexes, "each tube may be fired at most once per salvo");

  const accountByTube = new Map<number, string>();
  for (const account of o.reservation.accounts) {
    accountByTube.set(account.tubeIndex, account.modelId);
  }
  if (fireOrder.some((t) => !accountByTube.has(t)))
    invariant(
      "reservation",
      o.reservation,
      "every accepted tube must have a reservation account (reserveSalvoTorpedoes first)",
    );

  const attempts: TorpedoTubeLaunchAttempt[] = [];
  const tracks: TorpedoTrack[] = [];
  const restoredTubes = new Map<number, string>();
  let successfulLaunchesSoFar = 0;
  let skippedTubeIds: readonly number[] = [];
  const rec = recommendSalvoSize(o.salvoPolicy, fireOrder.length);

  for (const tubeId of fireOrder) {
    if (skippedTubeIds.length > 0) break;

    const model = compiledTorpedoOf(o.torpedoes, accountByTube.get(tubeId)!);
    const failureChanceBp = computeLaunchFailureChanceBp({
      launcherDamageState: o.reservation.state.damageState,
      modelReliabilityBp: model.reliabilityBp,
      crewQualityBp: o.crewQualityBp,
    });
    const drawStreamId = torpedoLaunchFailureStreamId({
      battleId: o.battleId,
      launchMinute: o.launchMinute,
      firingSubstep,
      launcherId: o.reservation.state.launcherId,
      tubeId,
    });
    const draw = o.keyedRng(drawStreamId);
    const evaluated = evaluateTubeLaunchDraw({ failureChanceBp, draw });
    const attempt: TorpedoTubeLaunchAttempt = {
      tubeId,
      firingSubstep,
      outcome: evaluated.outcome,
      reasonCode:
        evaluated.outcome === "SUCCESS"
          ? null
          : evaluated.outcome === "TORPEDO_STUCK_IN_TUBE"
            ? TORPEDO_STUCK_IN_TUBE
            : TORPEDO_LAUNCH_FAILURE,
      failureChanceBp,
      stuckBoundaryBp: evaluated.stuckBoundaryBp,
      drawBp: evaluated.drawBp,
      drawStreamId,
    };
    attempts.push(attempt);

    if (evaluated.outcome === "SUCCESS") {
      successfulLaunchesSoFar += 1;
      tracks.push(
        createTorpedoTrack({
          battleId: o.battleId,
          launcherId: o.reservation.state.launcherId,
          firingShipId: o.firingShipId,
          firingSideId: o.firingSideId,
          tubeId,
          targetContactId: o.targetContactId,
          torpedoModelId: model.partId,
          reliabilityBp: model.reliabilityBp,
          guidanceCapability: model.guidanceCapability,
          selectedSetting: o.selectedSetting,
          armingDistanceM: model.minimumArmingDistanceM,
          launchMinute: o.launchMinute,
          launchSubstep: firingSubstep,
          launchPosition: o.launchPosition,
          launchHeadingMdeg: o.launchHeadingMdeg,
          orderedGyroAngleMdeg: o.orderedGyroAngleMdeg,
          depthSettingM: o.depthSettingM,
        }),
      );
      continue;
    }

    if (evaluated.outcome === "TORPEDO_LAUNCH_FAILURE") {
      restoredTubes.set(tubeId, accountByTube.get(tubeId)!);
    }
    if (
      !salvoContinuesAfterFailure({
        salvoPolicy: o.salvoPolicy,
        acceptedTubeCount: fireOrder.length,
        successfulLaunchesSoFar,
      })
    ) {
      skippedTubeIds = fireOrder.filter((t) => t > tubeId);
    }
  }

  const loadedPerTube = [...o.reservation.state.loadedPerTube];
  for (const [tubeId, modelId] of restoredTubes) {
    loadedPerTube[tubeId] = modelId;
  }
  for (const tubeId of skippedTubeIds) {
    loadedPerTube[tubeId] = accountByTube.get(tubeId)!;
  }
  const state = withTorpedoLauncherStateHash({
    ...o.reservation.state,
    loadedPerTube,
  });

  return {
    state,
    attempts,
    skippedTubeIds,
    tracks,
    salvo: { recommendedSize: rec.recommendedSize, scoreBp: rec.scoreBp },
  };
}
