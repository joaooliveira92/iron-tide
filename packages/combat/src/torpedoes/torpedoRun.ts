// The mutable per-minute torpedo resolution run: shared state, setup, the
// exhaustion record, STAGE 4 (damage), and the §28-ordered assembly. The launch/
// advance/hit stages live in ./torpedoStages.js.
import type { ShipDamageState } from "../damage/state.js";
import { NO_TARGET_CONTACT } from "./constants.js";
import type { Position } from "../spotting/detection.js";
import { compareTrackRunOrder, torpedoRecordOrder } from "./ordering.js";
import type { TorpedoTrack } from "./track.js";
import type { TorpedoLauncherState } from "./state.js";
import type { TorpedoRecord } from "./records.js";
import {
  applyTorpedoChainReactionPackage,
  applyTorpedoDamagePackage,
  createTorpedoDamagePackage,
  type TorpedoDamagePackageInput,
} from "./damagePackage.js";
import {
  evaluateTorpedoMachineryDamage,
  machinerySeverityToComponentOutcome,
} from "./machinery.js";
import { evaluateTorpedoSystemShock } from "./systemShock.js";
import { resolveTorpedoChainReaction } from "./chainReaction.js";
import { TORPEDO_CHAIN_REACTION_NEUTRAL_MODIFIER_BP } from "./damageConstants.js";
import {
  NEUTRAL_DAMAGE_EFFECTS,
  TORPEDO_RESOLVE_IMPACT_SUBSTEP,
  assertUniqueRecordIds,
  commandSourceOf,
  damageRecordsFor,
  invariant,
  keyedRngOf,
  makeRecord,
  modelWarheadEquivalentKg,
  torpedoEventFor,
  tubeMarker,
} from "./torpedoSupport.js";
import type {
  ResolveTorpedoesInput,
  TorpedoLauncherWiring,
  TorpedoResolution,
  TorpedoTargetContext,
} from "./resolve.js";

/** The §22 neutral modifier manifest (isolation/flooding/protection/fire/
 *  existingDamage — the engine exposes no finer damage-control surface yet). */
const CHAIN_REACTION_NEUTRAL_MODIFIERS = Object.freeze({
  isolation: TORPEDO_CHAIN_REACTION_NEUTRAL_MODIFIER_BP,
  flooding: TORPEDO_CHAIN_REACTION_NEUTRAL_MODIFIER_BP,
  protection: TORPEDO_CHAIN_REACTION_NEUTRAL_MODIFIER_BP,
  fireIntensity: TORPEDO_CHAIN_REACTION_NEUTRAL_MODIFIER_BP,
  existingDamage: TORPEDO_CHAIN_REACTION_NEUTRAL_MODIFIER_BP,
});

interface TrackSolution {
  inputs: readonly { key: string; value: number }[];
  qualityBp: number | null;
}

/** Mutable per-minute torpedo resolution state, threaded through every stage. */
export interface TorpedoRun {
  input: ResolveTorpedoesInput;
  battleId: string;
  minute: number;
  records: TorpedoRecord[];
  recordDiscriminators: Map<string, string>;
  launcherStates: Map<string, TorpedoLauncherState>;
  damageStates: Map<string, ShipDamageState>;
  keyedRng: (stream: string) => number;
  launcherById: Map<string, TorpedoLauncherWiring>;
  targetByContact: Map<string, TorpedoTargetContext>;
  sideOf: (shipId: string) => string;
  runningTracks: TorpedoTrack[];
  trackLaunchSolution: Map<string, TrackSolution>;
  income: TorpedoTrack[];
}

export interface TorpedoAdvance {
  toEvaluate: TorpedoTrack[];
  sweptFrom: Map<string, Position>;
  exhaustOnMiss: Map<string, TorpedoTrack>;
}

// Input integrity (fail closed on structurally malformed input) + setup.
export function createTorpedoRun(input: ResolveTorpedoesInput): TorpedoRun {
  const { context } = input;
  const launcherById = new Map<string, TorpedoLauncherWiring>();
  for (const wiring of context.launchers) {
    if (launcherById.has(wiring.launcher.launcherId))
      invariant(
        "launcherId",
        wiring.launcher.launcherId,
        "a launcher id must be unique across the battle",
      );
    launcherById.set(wiring.launcher.launcherId, wiring);
  }
  const targetByContact = new Map<string, TorpedoTargetContext>();
  for (const shipId of Object.keys(context.targets).sort()) {
    const target = context.targets[shipId]!;
    if (targetByContact.has(target.contactId))
      invariant("targets.contactId", target.contactId, "one contact must map to exactly one ship");
    targetByContact.set(target.contactId, target);
  }
  const sideOf = (shipId: string): string => {
    for (const wiring of context.launchers) {
      if (wiring.ownerShipId === shipId) return wiring.sideId;
    }
    return "";
  };
  const income = (context.tracks ?? []).filter((t) => t.terminalResult === null);
  const runningTracks: TorpedoTrack[] = [...income]
    .sort(compareTrackRunOrder)
    .map((t) => ({ ...t }));

  return {
    input,
    battleId: input.battleId,
    minute: input.minute,
    records: [],
    recordDiscriminators: new Map(),
    launcherStates: new Map(),
    damageStates: new Map(),
    keyedRng: keyedRngOf(input.engine),
    launcherById,
    targetByContact,
    sideOf,
    runningTracks,
    trackLaunchSolution: new Map(),
    income,
  };
}

// §22 exhaustion record (used by the advance + hit-resolution stages).
export function recordExhaustion(run: TorpedoRun, track: TorpedoTrack): void {
  run.records.push(
    makeRecord(run.battleId, {
      kind: "TRACK",
      battleMinute: run.minute,
      substep: TORPEDO_RESOLVE_IMPACT_SUBSTEP,
      sourceId: track.torpedoTrackId,
      targetId: track.targetContactId,
      commandSource: commandSourceOf(track, run.launcherById),
      legalContactId: track.targetContactId === NO_TARGET_CONTACT ? null : track.targetContactId,
      torpedoModelId: track.torpedoModelId,
      launcherId: track.launcherId,
      settingId: track.selectedSettingId,
      damageEffects: { ...NEUTRAL_DAMAGE_EFFECTS, terminalTransition: "EXHAUSTION" },
    }),
  );
}

// STAGE 4 — DAMAGE (substep 56, §28 level 7 order).
export function runDamageStage(
  run: TorpedoRun,
  damageQueue: { track: TorpedoTrack; target: TorpedoTargetContext }[],
): void {
  const { battleId, minute, keyedRng } = run;
  for (const demand of damageQueue) {
    const { track, target } = demand;
    const state = run.damageStates.get(target.shipId) ?? target.damageState;
    // §19/§20 pre-evaluation — the package fields carry the SAME keyed draws
    // the atomic application re-consumes.
    const machinery = target.machinery
      ? evaluateTorpedoMachineryDamage({
          battleId,
          impactMinute: minute,
          impactSubstep: TORPEDO_RESOLVE_IMPACT_SUBSTEP,
          torpedoTrackId: track.torpedoTrackId,
          zone: target.machinery.zone,
          machineryComponents: target.machinery.machineryComponents,
          keyedRng,
        })
      : null;
    const shield = target.shockCandidates
      ? evaluateTorpedoSystemShock({
          battleId,
          impactMinute: minute,
          impactSubstep: TORPEDO_RESOLVE_IMPACT_SUBSTEP,
          entityId: track.torpedoTrackId,
          candidates: target.shockCandidates,
          keyedRng,
        })
      : null;
    const packageInput: TorpedoDamagePackageInput = {
      battleId,
      battleMinute: minute,
      substep: TORPEDO_RESOLVE_IMPACT_SUBSTEP,
      torpedoTrackId: track.torpedoTrackId,
      targetShipId: target.shipId,
      targetContactId: target.contactId,
      impactZone: target.zone,
      impactSide: target.scene.impactSide,
      longitudinalPositionM: target.scene.longitudinalPositionM,
      warheadExplosiveEquivalentMassKg: modelWarheadEquivalentKg(
        run.input.context.torpedoes,
        track.torpedoModelId,
      ),
      detonationDepthM: track.depthSettingM,
      protectionLevel: target.protectionLevel,
      hullBreachAreaM2: target.scene.hullBreachAreaM2,
      isolationState: target.scene.isolationState,
      machinery: machinery
        ? {
            severity: machinery.severity,
            affectedComponents: machinery.componentEffects.map((c) => c.componentId),
            componentOutcome: machinerySeverityToComponentOutcome(machinery.severity),
          }
        : { severity: "NO_EFFECT", affectedComponents: [], componentOutcome: "UNAFFECTED" },
      nearbySystemShock: shield
        ? {
            affectedSystemId: shield.affectedSystem?.stableSystemId ?? null,
            componentOutcome: shield.affectedSystem ? "DESTROYED" : null,
          }
        : { affectedSystemId: null, componentOutcome: null },
      fireProbabilityBp: target.scene.fireProbabilityBp,
      crewCasualties: target.scene.crewCasualties,
      damageControlAccessibility: target.scene.damageControlAccessibility,
    };
    const pkg = createTorpedoDamagePackage(packageInput);
    const result = applyTorpedoDamagePackage({
      state,
      pkg,
      flooding: target.flooding,
      machinery: target.machinery,
      shockCandidates: target.shockCandidates,
      turretComponents: target.turretComponents,
      tubeHazard: target.tubeHazard,
      designFlotationReserve: target.designFlotationReserve,
      designStabilityScore: target.designStabilityScore,
      keyedRng,
      precomputedEffect: { machinery, systemShock: shield },
    });
    run.damageStates.set(target.shipId, result.newState);
    const command = commandSourceOf(track, run.launcherById);
    const solution = run.trackLaunchSolution.get(track.torpedoTrackId);
    run.records.push(
      ...damageRecordsFor(battleId, track, target, solution, command, result, {
        chain: false,
        discriminators: run.recordDiscriminators,
      }),
    );

    // ---- §21/§22 continuation on a TUBE_BAY severe hit --------------------
    if (result.tubeHazardResult?.severe && target.tubeHazard) {
      const chain = resolveTorpedoChainReaction({
        battleId,
        minute,
        substep: TORPEDO_RESOLVE_IMPACT_SUBSTEP,
        launcherId: target.tubeHazard.launcherId,
        loadedTorpedoes: target.tubeHazard.loadedChecks,
        torpedoes: run.input.context.torpedoes,
        modifiers: CHAIN_REACTION_NEUTRAL_MODIFIERS,
        keyedRng,
      });
      if (chain.reasonCode) {
        for (const check of chain.checks) {
          if (!check.detonated) continue;
          run.records.push(
            makeRecord(battleId, {
              kind: "CHAIN_REACTION",
              battleMinute: minute,
              substep: TORPEDO_RESOLVE_IMPACT_SUBSTEP,
              sourceId: track.torpedoTrackId,
              targetId: `launcher:${target.tubeHazard.launcherId}:${tubeMarker(check.tubeIndex)}`,
              commandSource: command,
              legalContactId:
                track.targetContactId === NO_TARGET_CONTACT ? null : track.targetContactId,
              torpedoModelId: check.torpedoModelId,
              launcherId: target.tubeHazard.launcherId,
              rngDecision: {
                streamId: check.decision.streamId,
                draw: check.decision.draw,
                drawBp: check.decision.drawBp,
              },
              damageEffects: { ...NEUTRAL_DAMAGE_EFFECTS, reasonCode: chain.reasonCode },
              persists: true,
            }),
          );
        }
        const { warheadExplosiveEquivalentMassKg: _w, ...packageContext } = packageInput;
        const chainResult = applyTorpedoChainReactionPackage({
          chain,
          packageContext,
          state: run.damageStates.get(target.shipId) ?? state,
          flooding: target.flooding,
          machinery: target.machinery,
          shockCandidates: target.shockCandidates,
          turretComponents: target.turretComponents,
          designFlotationReserve: target.designFlotationReserve,
          designStabilityScore: target.designStabilityScore,
          keyedRng,
        });
        run.damageStates.set(target.shipId, chainResult.newState);
        const chainRecs = damageRecordsFor(
          battleId,
          track,
          target,
          solution,
          command,
          chainResult,
          { chain: true, discriminators: run.recordDiscriminators },
        );
        run.records.push(...chainRecs);
      }
    }
  }
}

// Assemble the §28-ordered, unique-id-asserted resolution.
export function buildTorpedoResolution(
  run: TorpedoRun,
  continuedTracks: TorpedoTrack[],
): TorpedoResolution {
  const { battleId, minute, recordDiscriminators, launcherStates, damageStates, income } = run;
  const sortedRecords = [...run.records].sort(torpedoRecordOrder);
  assertUniqueRecordIds(sortedRecords, battleId, minute);
  const events = sortedRecords.map((r) =>
    torpedoEventFor(battleId, r, recordDiscriminators.get(r.recordId)),
  );
  const eventIds = events.map((e) => e.eventId);
  if (new Set(eventIds).size !== eventIds.length)
    invariant(
      "events.eventId",
      { battleId, minute, count: eventIds.length },
      "the torpedo stage must emit a unique eventId per record (a §22 chain explosion must not collide with its primary package)",
    );
  return {
    records: sortedRecords,
    events,
    launcherStates: Object.freeze(Object.fromEntries(launcherStates)),
    tracks: Object.freeze(continuedTracks.map((t) => ({ ...t }))),
    damageStates: Object.freeze(Object.fromEntries(damageStates)),
    changed:
      sortedRecords.length > 0 || events.length > 0 || income.length > 0 || launcherStates.size > 0,
  };
}
