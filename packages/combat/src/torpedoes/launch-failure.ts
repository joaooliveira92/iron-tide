//packages/combat/src/torpedoes/launch-failure.ts
// DESIGN-40 §12 launch timing/failure (INC-4): pure, deterministic per-tube
// launch outcomes for an ACCEPTED salvo (post atomic reservation).
//
// Ordering: tubes fire in ASCENDING tube-identifier order at the salvo's
// declared firing substep — the resolver sorts the accepted tube ids ascending
// and iterates in exactly that order. The keyed RNG is consulted ONLY inside
// each tube's failure draw (a domain-separated stream bound to the tube), so a
// random branch can never change the canonical tube order.
//
// Per-tube outcome: the draw (float [0,1) from the keyed stream) is converted
// to an integer basis-point draw drawBp = floor(draw * 10_000) and compared to
// the composed per-tube failure chance
//   failureChanceBp = clamp(0, 10_000,
//     100                                         (§12 base, pinned)
//     + floor((TORPEDO_RELIABILITY_SCALE          (§12 "model" — per-model
//         - reliabilityBp) / 250)                   reliabilityBp, 100_000 scale)
//     + TORPEDO_LAUNCH_FAILURE_DAMAGE_ADJUSTMENT_BP[damageState]   (§12 "damage")
//     + floor((5_000 - crewQualityBp) / 100)      (§12 "crew" — [0,10_000] bp)
//     + reliabilityBandAdjustmentBp(reliabilityBp) (§12 "reliability band"))
// drawBp < failureChanceBp  -> mechanical failure; within the failure band the
// first floor(failureChanceBp * TORPEDO_STUCK_IN_TUBE_SHARE_BP / 10_000) bp
// are TORPEDO_STUCK_IN_TUBE (CONSUMES the torpedo — it is wedged in the tube;
// the §21 tube-hit hazard resolves the physical consequences in INC-6) and the
// remainder is TORPEDO_LAUNCH_FAILURE (consumes NOTHING — the torpedo never
// leaves the tube and the tube stays loaded).
//
// Ammunition: the salvo reservation (INC-1 consumeForLaunch / INC-3
// reserveSalvoTorpedoes) consumed every selected tube's torpedo ATOMICALLY
// before any tube fires (§11). The resolver therefore receives the
// post-reservation state + accounts and RESTORES a non-stuck-failed tube's
// torpedo ("consumes no torpedo"); success and stuck-in-tube keep the tube
// consumed (stuck: "consumes a torpedo").
//
// Continuation: after a mechanical failure, later tubes continue only while the
// salvo policy permits it (§12). The shipped deterministic continuation rule
// reuses the INC-3 recommendSalvoSize: the policy authorizes recommendedSize
// tubes; a failure ABORTS the remaining tubes once successfulLaunchesSoFar
// has reached recommendedSize, and permits continuation while it has not
// (authored BALANCE TARGET — the policy's recommendation is the permit).
//
// Every attempted tube produces its OWN per-tube record (tubeId, outcome,
// reason code, failure chance, draw, stream id); tubes skipped by an abort
// produce no record and keep their (restored/reserved) load.
//
// Pure/deterministic: the ONLY randomness is the injected keyedRng stream
// function; no Math.random, clock, env, or I/O.
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

// Closed per-tube launch outcome. The failure outcomes are exactly the two
// shipped §12 codes (TORPEDO_STUCK_IN_TUBE consumes; TORPEDO_LAUNCH_FAILURE
// consumes nothing).
export type TorpedoTubeLaunchOutcome =
  | "SUCCESS"
  | "TORPEDO_STUCK_IN_TUBE"
  | "TORPEDO_LAUNCH_FAILURE";

// Per-tube launch record — every attempted tube is recorded separately (§12
// "every result is recorded separately").
export interface TorpedoTubeLaunchAttempt {
  tubeId: number; // the tube identifier (ascending fire order)
  firingSubstep: number; // the salvo's declared firing substep
  outcome: TorpedoTubeLaunchOutcome;
  // The shipped §12 failure code on failure; null on SUCCESS.
  reasonCode: TorpedoReasonCode | null;
  failureChanceBp: number; // the exact composed chance BEFORE the draw (bp)
  stuckBoundaryBp: number; // stuck-in-tube share of the failure band (0 on success)
  drawBp: number; // the keyed draw in basis points [0, 10_000)
  drawStreamId: string; // the domain-separated stream identity (determinism record)
}

export interface TorpedoLaunchResolution {
  // Post-launch launcher state: SUCCESS/STUCK tubes stay consumed (EMPTY), a
  // non-stuck MECHANICAL failure RESTORES the torpedo to its tube. The state
  // hash is recomputed authoritatively.
  state: TorpedoLauncherState;
  // One per attempted tube, in ascending tube order.
  attempts: readonly TorpedoTubeLaunchAttempt[];
  // Tubes the salvo policy stopped after a mechanical failure (no per-tube
  // record — they never attempted).
  skippedTubeIds: readonly number[];
  // One authoritative track per successful launch (§13).
  tracks: readonly TorpedoTrack[];
  // The deterministic continuation decision + the policy recommendation that
  // governed it (the INC-3 §11 policy result).
  salvo: {
    recommendedSize: number;
    scoreBp: number;
  };
}

// The §12 modifier composition inputs — decoupled so the failure chance is a
// pure function of the launcher damage state, the per-tube model, and the crew
// quality.
export interface TorpedoLaunchModifierInputs {
  launcherDamageState: LauncherDamageState;
  modelReliabilityBp: number; // the per-tube model's §1 reliabilityBp (100_000 scale)
  crewQualityBp: number; // crew skill/experience, integer bp [0, 10_000]
}

// Domain-separated per-tube keyed-RNG stream: the draw is BOUND to the tube
// (battleId + minute + substep + launcherId + tubeId) so identical inputs
// produce identical draws and a draw can never reorder tubes. The engine's
// keyedRng seam (engine.stream(domain).next()) yields the float [0,1).
export function torpedoLaunchFailureStreamId(o: {
  battleId: string;
  launchMinute: number;
  firingSubstep: number;
  launcherId: string;
  tubeId: number;
}): string {
  return `battle/ship/torpedo/launch_failure:${o.battleId}:${o.launchMinute}:${o.firingSubstep}:${o.launcherId}:tube${o.tubeId}`;
}

// AC-12: the exact composed per-tube failure chance (basis points).
//   failureChanceBp = clamp(0, 10_000, 100 + Δmodel + Δdamage + Δcrew + Δband)
// The composition is a deterministic sequence of signed integer basis-point
// adjustments over the §12-pinned 100 bp base. All arithmetic is integer; the
// floor steps are explicit. Documented in the module header; every adjustment
// value is an authored versioned-ruleset constant (BALANCE TARGET — DESIGN-40
// pins only the base and the four modifier categories).
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

// AC-12: map a keyed draw (float [0,1)) to the per-tube outcome — the pure
// draw -> outcome function (testable without RNG plumbing). The first
// floor(failureChanceBp * STUCK_SHARE_BP / 10_000) basis points of the failure
// band are TORPEDO_STUCK_IN_TUBE (consuming); the rest of the band is the
// non-consuming TORPEDO_LAUNCH_FAILURE; drawBp >= failureChanceBp succeeds.
export function evaluateTubeLaunchDraw(o: {
  failureChanceBp: number;
  draw: number; // keyed draw, float [0, 1)
  stuckShareBp?: number; // defaults to the shipped TORPEDO_STUCK_IN_TUBE_SHARE_BP
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

// AC-12: the deterministic §12 continuation rule. After a mechanical failure,
// later tubes continue only while successfulLaunchesSoFar is below the INC-3
// salvo policy's recommended size (the policy's recommendation is the permit;
// authored BALANCE TARGET, documented in the module header).
export function salvoContinuesAfterFailure(o: {
  salvoPolicy: TorpedoSalvoPolicyInputs;
  acceptedTubeCount: number;
  successfulLaunchesSoFar: number;
}): boolean {
  const rec = recommendSalvoSize(o.salvoPolicy, o.acceptedTubeCount);
  return o.successfulLaunchesSoFar < rec.recommendedSize;
}

// AC-12: resolve the accepted salvo's per-tube launch outcomes. The resolver
// receives the POST-reservation state + accounts (INC-3 reserveSalvoTorpedoes —
// the §11 atomic reservation consumed every selected tube) and the accepted
// tube ids in ANY order; it fires in ASCENDING tube-id order at the declared
// firing substep. Tubes are restored on a non-stuck mechanical failure;
// successes and stuck-in-tube keep the tube consumed. The keyedRng is
// consulted only per tube via the tube-bound stream — the RNG can never
// reorder the canonical fire order.
export function resolveTubeLaunches(o: {
  battleId: string;
  firingShipId: string;
  firingSideId: string;
  reservation: TorpedoConsumeResult; // post-atomic-reservation state + accounts
  tubeIndexes: readonly number[]; // the accepted salvo's tube ids (any order)
  torpedoes: CompiledTorpedoRegistry; // the battle's compiled-torpedo records
  crewQualityBp: number; // crew skill/experience [0, 10_000] bp
  salvoPolicy: TorpedoSalvoPolicyInputs; // INC-3 §11 policy (continuation rule)
  selectedSetting: CompiledTorpedoSpeedSetting; // the salvo's selected speed/range setting
  launchMinute: number;
  firingSubstep?: number; // default TORPEDO_LAUNCH_SUBSTEP (the §12 declared substep)
  launchPosition: Position; // integer micrometres
  launchHeadingMdeg: number; // integer milli-degrees, full circle 360_000
  orderedGyroAngleMdeg: number; // integer milli-degrees (§13 ordered gyro angle)
  depthSettingM: number; // integer metres (§13 depth setting)
  targetContactId: string | null; // null -> the §13 NONE marker (area fire)
  keyedRng: (stream: string) => number; // deterministic keyed stream -> float [0,1)
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

  // Fire in ASCENDING tube-id order regardless of the declared salvo order.
  const fireOrder = [...o.tubeIndexes].sort((a, b) => a - b);
  if (!fireOrder.every((t) => Number.isInteger(t) && t >= 0))
    invariant("tubeIndexes", o.tubeIndexes, "every tube id must be a non-negative integer");
  if (new Set(fireOrder).size !== fireOrder.length)
    invariant("tubeIndexes", o.tubeIndexes, "each tube may be fired at most once per salvo");

  // The atomic reservation must account for EXACTLY the accepted tubes (a
  // mis-accounted reservation is a caller bug — fail closed, never silently
  // restore or consume the wrong tube).
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
    // A tube skipped by a previous failure's abort never attempts (no record).
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

    // Mechanical failure: continuation per §12 (only while the salvo policy
    // permits). A non-stuck failure RESTORES the torpedo to its tube.
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

  // Rebuild the launcher state: the reservation consumed every selected tube;
  // restore BOTH the non-stuck-failed tubes (their torpedoes were "not
  // consumed") AND the skipped tubes — a tube the abort stops before it fires
  // never expended its atomically-reserved torpedo, so its load is restored
  // too. Success and stuck-in-tube keep the tube consumed.
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
