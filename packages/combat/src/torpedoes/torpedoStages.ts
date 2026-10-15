// STAGES 1-3 of the per-minute DESIGN-40 torpedo resolution (launch → advance →
// hit resolution + detonation). Run state lives in ./torpedoRun.js; STAGE 4
// (damage) and the assembly live there too.
import { SUBSTEPS_PER_MINUTE } from "../movement/constants.js";
import type { Position } from "../spotting/detection.js";
import { advanceTorpedoTrack, type TorpedoTrack } from "./track.js";
import { resolveTorpedoHit, type TargetHitProfile } from "./hit-resolution.js";
import { applyTorpedoDetonationToTrack, resolveTorpedoDetonation } from "./detonation.js";
import { reserveSalvoTorpedoes } from "./salvo.js";
import { resolveTubeLaunches } from "./launch-failure.js";
import { assertFixedPointTorpedo } from "./state.js";
import { compareLaunchCommandOrder } from "./ordering.js";
import {
  EMPTY_TUBE,
  NO_TARGET_CONTACT,
  TORPEDO_BASIS_POINTS_PER_UNIT,
  TORPEDO_LAUNCH_SUBSTEP,
  TORPEDO_MINUTE_MS,
  torpedoSpeedBpKnotsToUmS,
} from "./constants.js";
import {
  NEUTRAL_DAMAGE_EFFECTS,
  TORPEDO_RESOLVE_IMPACT_SUBSTEP,
  TORPEDO_RESOLUTION_DEFAULT_DEPTH_M,
  commandSourceOf,
  invariant,
  isSafeInt,
  launchSolutionInputs,
  makeRecord,
  resolvedSettingForCommand,
  speedVerdictFor,
  tubeMarker,
} from "./torpedoSupport.js";
import { recordExhaustion, type TorpedoAdvance, type TorpedoRun } from "./torpedoRun.js";
import type { TorpedoTargetContext } from "./resolve.js";

// STAGE 1 — LAUNCH (substep 4).
export function runLaunchStage(run: TorpedoRun): void {
  const { input, battleId, minute, sideOf, launcherById, keyedRng } = run;
  const commandOrder = [...input.context.commands].sort((a, b) =>
    compareLaunchCommandOrder(a, b, sideOf),
  );

  for (const cmd of commandOrder) {
    const wiring = launcherById.get(cmd.launcherId);
    if (!wiring)
      invariant("launcherId", cmd.launcherId, "a command must reference a wired launcher");
    if (wiring.ownerShipId !== cmd.shipId)
      invariant("shipId", cmd.shipId, "a command's ship must own the referenced launcher");
    assertFixedPointTorpedo(wiring.launcher);
    const position = input.shipPositions[cmd.shipId];
    if (!position || !isSafeInt(position[0]) || !isSafeInt(position[1]))
      invariant("shipPositions", cmd.shipId, "the firing ship must have a battle position");
    const headingDeg = input.shipHeadings[cmd.shipId] ?? 0;
    if (!isSafeInt(headingDeg) || headingDeg < 0 || headingDeg > 359)
      invariant("shipHeadings", headingDeg, "a ship heading must be an integer degree [0, 359]");
    const shipSpeed = input.shipSpeedsUmS[cmd.shipId] ?? 0;
    const speedVerdict = speedVerdictFor(
      wiring.launcher.mountType,
      shipSpeed,
      wiring.aboveWaterMaxLaunchSpeedKnots,
    );
    const firingSubstep = cmd.firingSubstep ?? TORPEDO_LAUNCH_SUBSTEP;
    if (!isSafeInt(firingSubstep) || firingSubstep < 1 || firingSubstep >= SUBSTEPS_PER_MINUTE)
      invariant("firingSubstep", firingSubstep, "firing substep must be within [1, 60)");
    const offset = wiring.launchPointOffsetUm ?? [0, 0];
    const launchPosition: Position = [position[0] + offset[0], position[1] + offset[1]];
    const launchHeadingMdeg = headingDeg * 1_000; // §13 milli-degrees
    // §13 guidance invariant: while running, a gyro-guided torpedo's ordered
    // course must equal its launch heading — the default (unset) gyro is the
    // straight run along the ship's heading.
    const gyro = cmd.orderedGyroAngleMdeg ?? launchHeadingMdeg;
    const depthM = cmd.depthSettingM ?? TORPEDO_RESOLUTION_DEFAULT_DEPTH_M;
    if (!isSafeInt(gyro) || !isSafeInt(depthM) || depthM < 0)
      invariant("depth/gyro", { gyro, depthM }, "ordered gyro/depth must be safely integer");
    const legalContact = cmd.targetContactId === NO_TARGET_CONTACT ? null : cmd.targetContactId;

    // ---- §7/§8 checkpoint 2 (an illegal launch consumes NO torpedo) ---------
    if (!speedVerdict.allowed) {
      const tubes = [...cmd.tubeIndexes].sort((a, b) => a - b);
      const firstTube = tubes[0]!;
      const tubeModel = wiring.launcher.loadedPerTube[firstTube];
      run.records.push(
        makeRecord(battleId, {
          kind: "LAUNCH",
          battleMinute: minute,
          substep: firingSubstep,
          sourceId: `${cmd.shipId}:${cmd.launcherId}`,
          targetId: tubeMarker(firstTube),
          commandSource: wiring.commandSource,
          legalContactId: legalContact,
          torpedoModelId: tubeModel && tubeModel !== EMPTY_TUBE ? tubeModel : null,
          launcherId: cmd.launcherId,
          settingId: null,
          solutionInputs: [],
          solutionQualityBp: cmd.salvoPolicy.solutionQualityBp,
          speedLimitValidation: speedVerdict,
          damageEffects: { ...NEUTRAL_DAMAGE_EFFECTS, reasonCode: speedVerdict.reasonCode },
        }),
      );
      continue;
    }

    // ---- atomic §11 reservation, launch, per-tube records, track creation ---
    const reservation = reserveSalvoTorpedoes(wiring.launcher, cmd.tubeIndexes); // §3, atomic
    const accountByTube = new Map(reservation.accounts.map((a) => [a.tubeIndex, a]));
    const salvoTubes = [...cmd.tubeIndexes].sort((a, b) => a - b);
    const salvoModelId = accountByTube.get(salvoTubes[0]!)!.modelId;
    const setting = resolvedSettingForCommand(
      input.context.torpedoes,
      salvoModelId,
      cmd.selectedSettingId,
    );

    const launched = resolveTubeLaunches({
      battleId,
      firingShipId: cmd.shipId,
      firingSideId: sideOf(cmd.shipId),
      reservation,
      tubeIndexes: cmd.tubeIndexes,
      torpedoes: input.context.torpedoes,
      crewQualityBp: wiring.crewQualityBp,
      salvoPolicy: cmd.salvoPolicy,
      selectedSetting: setting,
      launchMinute: minute,
      firingSubstep,
      launchPosition,
      launchHeadingMdeg,
      orderedGyroAngleMdeg: gyro,
      depthSettingM: depthM,
      targetContactId: legalContact,
      keyedRng,
    });

    // every attempted tube is recorded separately (§12)
    for (const attempt of launched.attempts) {
      const account = accountByTube.get(attempt.tubeId);
      const ammoModel = account?.modelId ?? null;
      const after: "LOADED" | "EMPTY" =
        attempt.outcome === "TORPEDO_LAUNCH_FAILURE" ? "LOADED" : "EMPTY";
      run.records.push(
        makeRecord(battleId, {
          kind: "LAUNCH",
          battleMinute: minute,
          substep: firingSubstep,
          sourceId: `${cmd.shipId}:${cmd.launcherId}`,
          targetId: tubeMarker(attempt.tubeId),
          commandSource: wiring.commandSource,
          legalContactId: legalContact,
          torpedoModelId: ammoModel,
          launcherId: cmd.launcherId,
          settingId: setting.settingId,
          solutionInputs: launchSolutionInputs(setting, gyro, depthM),
          solutionQualityBp: cmd.salvoPolicy.solutionQualityBp,
          speedLimitValidation: speedVerdict,
          ammunitionChange: {
            tubeId: attempt.tubeId,
            torpedoModelId: ammoModel,
            before: "LOADED",
            after: after,
          },
          rngDecision: {
            streamId: attempt.drawStreamId,
            draw: attempt.drawBp / TORPEDO_BASIS_POINTS_PER_UNIT,
            drawBp: attempt.drawBp,
          },
          damageEffects: {
            ...NEUTRAL_DAMAGE_EFFECTS,
            reasonCode: attempt.outcome === "SUCCESS" ? null : attempt.reasonCode,
          },
        }),
      );
    }

    // each successful launch created an authoritative track (§13)
    for (const track of launched.tracks) {
      run.runningTracks.push(track);
      run.records.push(
        makeRecord(battleId, {
          kind: "TRACK",
          battleMinute: minute,
          substep: track.launchSubstep,
          sourceId: track.torpedoTrackId,
          targetId: legalContact ?? NO_TARGET_CONTACT,
          commandSource: wiring.commandSource,
          legalContactId: legalContact,
          torpedoModelId: track.torpedoModelId,
          launcherId: track.launcherId,
          settingId: track.selectedSettingId,
          solutionInputs: launchSolutionInputs(setting, gyro, depthM),
          solutionQualityBp: cmd.salvoPolicy.solutionQualityBp,
          speedLimitValidation: speedVerdict,
          ammunitionChange: {
            tubeId: track.tubeId,
            torpedoModelId: track.torpedoModelId,
            before: "LOADED",
            after: "EMPTY",
          },
        }),
      );
      run.trackLaunchSolution.set(track.torpedoTrackId, {
        inputs: launchSolutionInputs(setting, gyro, depthM),
        qualityBp: cmd.salvoPolicy.solutionQualityBp,
      });
    }
    run.launcherStates.set(cmd.launcherId, launched.state);
  }
}

// STAGE 2 — ADVANCE (whole-minute).
export function runAdvanceStage(run: TorpedoRun): TorpedoAdvance {
  const { minute } = run;
  const toEvaluate: TorpedoTrack[] = [];
  const sweptFrom = new Map<string, Position>();
  const exhaustOnMiss = new Map<string, TorpedoTrack>();
  for (const track of run.runningTracks) {
    const dtMs =
      track.launchMinute === minute
        ? (SUBSTEPS_PER_MINUTE - track.launchSubstep) * 1_000
        : TORPEDO_MINUTE_MS;
    if (dtMs <= 0) {
      toEvaluate.push(track);
      continue;
    }
    const advanced = advanceTorpedoTrack(track, dtMs);
    if (advanced.terminalResult === "EXHAUSTION") {
      // last running point: 1 m short of the run's end
      const remainingUm = track.maxRunDistanceM * 1_000_000 - track.distanceTraveledUm - 1_000_000;
      const speedUmS = torpedoSpeedBpKnotsToUmS(track.speedKnotsBp);
      const msToEnd = remainingUm > 0 ? Math.floor((remainingUm * 1_000) / speedUmS) : 0;
      if (msToEnd > 0) {
        const runEnd = advanceTorpedoTrack(track, msToEnd);
        if (runEnd.terminalResult === null) {
          sweptFrom.set(runEnd.torpedoTrackId, track.currentPosition);
          exhaustOnMiss.set(runEnd.torpedoTrackId, advanced);
          toEvaluate.push(runEnd);
          continue;
        }
      }
      recordExhaustion(run, track);
      continue; // terminal — no hit evaluation this minute
    }
    sweptFrom.set(advanced.torpedoTrackId, track.currentPosition);
    toEvaluate.push(advanced);
  }
  return { toEvaluate, sweptFrom, exhaustOnMiss };
}

// STAGE 3 — HIT RESOLUTION + DETONATION (substep 56).
export function runHitDetonationStage(
  run: TorpedoRun,
  advance: TorpedoAdvance,
): {
  continuedTracks: TorpedoTrack[];
  damageQueue: { track: TorpedoTrack; target: TorpedoTargetContext }[];
} {
  const { input, battleId, minute, targetByContact, keyedRng } = run;
  const { toEvaluate, sweptFrom, exhaustOnMiss } = advance;
  const continuedTracks: TorpedoTrack[] = [];
  const damageQueue: { track: TorpedoTrack; target: TorpedoTargetContext }[] = [];

  for (const track of toEvaluate) {
    // §14(6): the impact instant must lie strictly after the launch instant —
    // a torpedo launched at/after the evaluation substep continues next minute.
    if (track.launchMinute === minute && track.launchSubstep >= TORPEDO_RESOLVE_IMPACT_SUBSTEP) {
      continuedTracks.push(track);
      continue;
    }
    const target = targetByContact.get(track.targetContactId);
    const hasTarget = track.targetContactId !== NO_TARGET_CONTACT && target !== undefined;
    const profile: TargetHitProfile | null = hasTarget
      ? {
          targetId: target!.shipId,
          contactId: target!.contactId,
          collisionRadiusM: target!.profile.collisionRadiusM,
          draftM: target!.profile.draftM,
          terminalStatus: target!.damageState.terminalStatus,
        }
      : null;
    const hit = resolveTorpedoHit({
      track,
      target: profile,
      knownTracks: [...input.contacts],
      blocker: null,
      impactMinute: minute,
      impactSubstep: TORPEDO_RESOLVE_IMPACT_SUBSTEP,
      ...(sweptFrom.has(track.torpedoTrackId)
        ? { sweptFrom: sweptFrom.get(track.torpedoTrackId)! }
        : {}),
    });
    const solution = run.trackLaunchSolution.get(track.torpedoTrackId);
    const commandSource = commandSourceOf(track, run.launcherById);
    run.records.push(
      makeRecord(battleId, {
        kind: "HIT_RESOLUTION",
        battleMinute: minute,
        substep: TORPEDO_RESOLVE_IMPACT_SUBSTEP,
        sourceId: track.torpedoTrackId,
        targetId: hit.targetContactId,
        commandSource,
        legalContactId: hit.targetContactId === NO_TARGET_CONTACT ? null : hit.targetContactId,
        torpedoModelId: track.torpedoModelId,
        launcherId: track.launcherId,
        settingId: track.selectedSettingId,
        solutionInputs: solution?.inputs ?? [],
        solutionQualityBp: solution?.qualityBp ?? null,
        damageEffects: { ...NEUTRAL_DAMAGE_EFFECTS, reasonCode: hit.reasonCode },
      }),
    );
    if (!hit.hit) {
      const exhausted = exhaustOnMiss.get(track.torpedoTrackId);
      if (exhausted) recordExhaustion(run, exhausted);
      else continuedTracks.push(track);
      continue;
    }

    // ---- a RESOLVED hit proceeds to detonation (§15) ---------------------
    const detonation = resolveTorpedoDetonation({
      track,
      hit,
      impact: { zone: target?.zone ?? null, deviationMdeg: 0 },
      targetProtection: target?.protectionLevel ?? null,
      damageState: hasTarget
        ? { progressiveFloodingTotalKg: target!.damageState.progressiveFloodingTotal }
        : null,
      prematureEnvironment: { wakeIntercept: false },
      keyedRng,
    });
    run.records.push(
      makeRecord(battleId, {
        kind: "DETONATION",
        battleMinute: minute,
        substep: TORPEDO_RESOLVE_IMPACT_SUBSTEP,
        sourceId: track.torpedoTrackId,
        targetId: hit.targetContactId,
        commandSource,
        legalContactId: hit.targetContactId === NO_TARGET_CONTACT ? null : hit.targetContactId,
        torpedoModelId: track.torpedoModelId,
        launcherId: track.launcherId,
        settingId: track.selectedSettingId,
        solutionInputs: solution?.inputs ?? [],
        solutionQualityBp: solution?.qualityBp ?? null,
        rngDecision: detonation.decision.streamId
          ? {
              streamId: detonation.decision.streamId,
              draw: detonation.decision.draw,
              drawBp: detonation.decision.drawBp,
            }
          : null,
        damageEffects: { ...NEUTRAL_DAMAGE_EFFECTS, reasonCode: detonation.reasonCode },
      }),
    );

    const terminalTrack = applyTorpedoDetonationToTrack({ track, outcome: detonation.outcome });
    if (terminalTrack.terminalResult === null) {
      // NO_CONTACT keeps the torpedo authoritative; it continues to run.
      continuedTracks.push(terminalTrack);
      continue;
    }
    if (detonation.functioned && target) {
      damageQueue.push({ track, target });
    }
  }
  return { continuedTracks, damageQueue };
}
