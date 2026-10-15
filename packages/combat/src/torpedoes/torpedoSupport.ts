// Shared stage constants, the §27 record builder, and helper guards for the
// torpedo resolution stage. Split out of ./resolve.js.
import { BluewaveError } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import { BattleEvent } from "../battleLedger.js";
import { TORPEDO_FORMULA_VERSION, TORPEDO_RULESET_VERSION } from "./constants.js";
import type { CompiledTorpedoSpeedSetting } from "@bluewave/armament";
import { compiledTorpedoOf, type CompiledTorpedoRegistry } from "./registry.js";
import { type TorpedoTrack } from "./track.js";
import { type TorpedoDamageApplicationResult } from "./damagePackage.js";
import {
  validateAboveWaterLaunchSpeedLimit,
  validateUnderwaterTubeSpeedLimitFiringSubstep,
  type SpeedLimitVerdict,
} from "./launch-speed.js";
import { type TorpedoLauncherState } from "./state.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import {
  makeTorpedoRecord,
  torpedoRecordId,
  type TorpedoRecord,
  type TorpedoRecordKind,
} from "./records.js";
import type { TorpedoLauncherWiring, TorpedoTargetContext } from "./resolve.js";

export const TORPEDO_RESOLVE_IMPACT_SUBSTEP = 56 as const;
/** The BattleLedger event priority for every torpedo stage record — after the
 *  B-4 damage priority 10 (the torpedo stage runs after the damage stage). */
export const TORPEDO_RESOLUTION_EVENT_PRIORITY = 11 as const;
/** Default torpedo depth setting (metres) when a command leaves it open.
 *
 *  ADR-0031 entry (reviewer HIGH-4): this 5 m default is an AUTHORED decision —
 *  DESIGN-40 §12 leaves the depth setting open; the stage defaults it to 5 m
 *  (a representative shallow-running depth for the 1880–1945 surface-launch
 *  slice). Invented default, not a DESIGN-40 literal — recorded in ADR-0031. */
export const TORPEDO_RESOLUTION_DEFAULT_DEPTH_M = 5 as const;
/** Default ordered gyro angle when a command leaves it open — the straight run
 *  along the ship's launch heading (see resolveTorpedoes). */
export const TORPEDO_DEFAULT_ORDERED_GYRO_MDEG = 0 as const;

export function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

export function isSafeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

/** The §28 level-4 tube marker ("tube" + zero-padded index — the string sort
 *  reproduces the canonical ascending tube order). */
export function tubeMarker(tubeId: number): string {
  return `tube${String(tubeId).padStart(4, "0")}`;
}

export function speedVerdictFor(
  mountType: TorpedoLauncherState["mountType"],
  speedUmS: number,
  aboveWaterMaxLaunchSpeedKnots: number | null | undefined,
): SpeedLimitVerdict {
  if (mountType === "UNDERWATER_FIXED" || mountType === "UNDERWATER_TRAINABLE") {
    return validateUnderwaterTubeSpeedLimitFiringSubstep(speedUmS, mountType);
  }
  if (mountType === "ABOVE_WATER_FIXED" || mountType === "ABOVE_WATER_TRAINABLE") {
    return validateAboveWaterLaunchSpeedLimit(speedUmS, aboveWaterMaxLaunchSpeedKnots ?? null);
  }
  // SUBMARINE_INTERNAL → C-3 (submarine-launch mechanics deferred).
  return { applicable: false, allowed: true, reasonCode: null, speedUmS, limitUmS: null };
}

export function keyedRngOf(engine: RandomEngine | undefined): (stream: string) => number {
  return (stream: string): number => (engine ? engine.stream(stream).next() : 0);
}

export function modelWarheadEquivalentKg(
  torpedoes: CompiledTorpedoRegistry,
  modelId: string,
): number {
  return compiledTorpedoOf(torpedoes, modelId).warheadExplosiveEquivalentMassKg;
}

export function commandSourceOf(
  track: TorpedoTrack,
  launcherById: ReadonlyMap<string, TorpedoLauncherWiring>,
): string {
  return launcherById.get(track.launcherId)?.commandSource ?? "ENGINE_STAGE";
}

// the §27 record builder (single factory for every record the stage emits)

export interface RecordSeed {
  kind: TorpedoRecordKind;
  battleMinute: number;
  substep: number;
  sourceId: string;
  targetId: string;
  commandSource: string;
  legalContactId?: string | null;
  torpedoModelId?: string | null;
  launcherId?: string | null;
  settingId?: string | null;
  solutionInputs?: readonly { key: string; value: number }[];
  solutionQualityBp?: number | null;
  speedLimitValidation?: SpeedLimitVerdict;
  ammunitionChange?: TorpedoRecord["ammunitionChange"];
  rngDecision?: TorpedoRecord["rngDecision"];
  damageEffects?: TorpedoRecord["damageEffects"];
  persists?: boolean;
  /** Optional disambiguator appended to the record id (the §22 chain explosion
   *  records share the primary package's source/target at the same instant —
   *  see torpedoRecordId). */
  discriminator?: string;
}

export const NEUTRAL_DAMAGE_EFFECTS: TorpedoRecord["damageEffects"] = Object.freeze({
  structuralDamage: 0,
  flotationDamage: 0,
  floodingSourcesCreated: 0,
  terminalTransition: null,
  reasonCode: null,
});

export function makeRecord(battleId: string, seed: RecordSeed): TorpedoRecord {
  const speed = seed.speedLimitValidation ?? {
    applicable: false,
    allowed: true,
    reasonCode: null,
    limitUmS: null,
  };
  return makeTorpedoRecord({
    recordId: torpedoRecordId({
      battleId,
      minute: seed.battleMinute,
      substep: seed.substep,
      kind: seed.kind,
      sourceId: seed.sourceId,
      targetId: seed.targetId,
      ...(seed.discriminator ? { discriminator: seed.discriminator } : {}),
    }),
    kind: seed.kind,
    battleMinute: seed.battleMinute,
    substep: seed.substep,
    sourceId: seed.sourceId,
    targetId: seed.targetId,
    commandSource: seed.commandSource,
    legalContactId: seed.legalContactId ?? null,
    torpedoModelId: seed.torpedoModelId ?? null,
    launcherId: seed.launcherId ?? null,
    settingId: seed.settingId ?? null,
    solutionInputs: seed.solutionInputs ?? [],
    solutionQualityBp: seed.solutionQualityBp ?? null,
    speedLimitValidation: {
      applicable: speed.applicable,
      allowed: speed.allowed,
      reasonCode: speed.reasonCode,
      limitUmS: speed.limitUmS,
    },
    ammunitionChange: seed.ammunitionChange ?? null,
    rngDecision: seed.rngDecision ?? null,
    damageEffects: seed.damageEffects ?? NEUTRAL_DAMAGE_EFFECTS,
    persists: seed.persists ?? false,
    formulaVersion: TORPEDO_FORMULA_VERSION,
    rulesetVersion: TORPEDO_RULESET_VERSION,
  });
}

export function launchSolutionInputs(
  setting: CompiledTorpedoSpeedSetting,
  gyroMdeg: number,
  depthM: number,
) {
  return [
    { key: "orderedSpeedKnotsBp", value: setting.speedMilliKnots },
    { key: "orderedRangeM", value: setting.rangeM },
    { key: "orderedGyroAngleMdeg", value: gyroMdeg },
    { key: "depthSettingM", value: depthM },
  ];
}

export function resolvedSettingForCommand(
  torpedoes: CompiledTorpedoRegistry,
  modelId: string,
  selectedSettingId: string | null | undefined,
): CompiledTorpedoSpeedSetting {
  const model = compiledTorpedoOf(torpedoes, modelId); // fail-closed
  if (selectedSettingId === null || selectedSettingId === undefined) {
    const first = model.speedSettings[0];
    if (!first) invariant("speedSettings", modelId, "a model must ship at least one setting");
    return first;
  }
  const found = model.speedSettings.find((s) => s.settingId === selectedSettingId);
  if (!found)
    invariant(
      "selectedSettingId",
      selectedSettingId,
      `the salvo selected a setting the launcher's model does not ship (${modelId})`,
    );
  return found;
}

export const EVENT_TYPES: Record<TorpedoRecordKind, string> = {
  LAUNCH: "torpedo_launch",
  TRACK: "torpedo_track",
  DETECTION: "torpedo_detection",
  HIT_RESOLUTION: "torpedo_hit",
  DETONATION: "torpedo_detonation",
  DAMAGE: "torpedo_damage",
  FLOODING_SOURCE: "torpedo_flooding_source",
  MACHINERY: "torpedo_machinery",
  SYSTEM_SHOCK: "torpedo_system_shock",
  TUBE_HAZARD: "torpedo_tube_hazard",
  CHAIN_REACTION: "torpedo_chain_reaction",
};

export function torpedoEventFor(
  battleId: string,
  record: TorpedoRecord,
  discriminator?: string,
): BattleEvent {
  const base = `${battleId}:${record.battleMinute}:${record.substep}:${EVENT_TYPES[record.kind]}:${record.sourceId}:${record.targetId}`;
  return {
    battleId,
    minute: record.battleMinute,
    substep: record.substep,
    eventPriority: TORPEDO_RESOLUTION_EVENT_PRIORITY,
    actorId: record.sourceId,
    targetId: record.targetId,
    // the §22 chain-explosion records share the primary package's actor/target
    // at the same instant — append the discriminator so every eventId is unique
    // (reviewer BLOCKER-1; the same suffix as the record id).
    eventId: discriminator ? `${base}:${discriminator}` : base,
    eventType: EVENT_TYPES[record.kind],
    eventHash: record.recordHash,
  };
}

/** AC-20 (reviewer BLOCKER-1): fail-closed assertion that every §27 record id
 *  emitted this minute is unique — even on the §22 chain path (whose explosion
 *  records share the primary package's source/target at the same instant and
 *  are disambiguated by the `chain` discriminator). Never weakened. */
export function assertUniqueRecordIds(
  sortedRecords: readonly TorpedoRecord[],
  battleId: string,
  minute: number,
): void {
  const seen = new Set<string>();
  for (const r of sortedRecords) {
    if (seen.has(r.recordId))
      invariant(
        "records.recordId",
        { recordId: r.recordId, battleId, minute, kind: r.kind },
        "the torpedo stage must emit a unique recordId per record (a §22 chain explosion must not collide with its primary package)",
      );
    seen.add(r.recordId);
  }
}

export function damageRecordsFor(
  battleId: string,
  track: TorpedoTrack,
  target: TorpedoTargetContext,
  solution:
    | { inputs: readonly { key: string; value: number }[]; qualityBp: number | null }
    | undefined,
  command: string,
  result: TorpedoDamageApplicationResult,
  opts: { chain: boolean; discriminators: Map<string, string> },
): TorpedoRecord[] {
  const recs: TorpedoRecord[] = [];
  const event = result.eventRecord;
  // Reviewer BLOCKER-1 — id/eventId uniqueness for the damage record family:
  //   - DAMAGE / MACHINERY / SYSTEM_SHOCK / TUBE_HAZARD carry sourceId = the
  //     torpedo track id, so they already differ across tracks; the §22 chain
  //     explosion (same track, same instant) needs the `chain` discriminator.
  //   - FLOODING_SOURCE carries sourceId = the COMPARTMENT (DESIGN-40 §28 level
  //     8), so two torpedoes hitting the same compartment in one minute would
  //     collide; its discriminator is scoped to the originating track (plus a
  //     `:chain` marker on the §22 chain explosion) to keep every record unique.
  const otherDiscriminator = opts.chain ? "chain" : undefined;
  const floodDiscriminator = `${track.torpedoTrackId}${opts.chain ? ":chain" : ""}`;
  const register = (rec: TorpedoRecord, discriminator: string | undefined): TorpedoRecord => {
    if (discriminator) opts.discriminators.set(rec.recordId, discriminator);
    return rec;
  };
  recs.push(
    register(
      makeRecord(battleId, {
        kind: "DAMAGE",
        battleMinute: event.battleMinute,
        substep: event.substep,
        sourceId: event.torpedoTrackId,
        targetId: event.targetShipId,
        commandSource: command,
        legalContactId: target.contactId,
        torpedoModelId: track.torpedoModelId,
        launcherId: track.launcherId,
        settingId: track.selectedSettingId,
        solutionInputs: solution?.inputs ?? [],
        solutionQualityBp: solution?.qualityBp ?? null,
        damageEffects: {
          structuralDamage: event.structuralDamage,
          flotationDamage: event.flotationDamage,
          floodingSourcesCreated: event.createdFloodingSources.length,
          terminalTransition: event.terminalTransition,
          reasonCode: null,
        },
        persists: true,
        ...(otherDiscriminator ? { discriminator: otherDiscriminator } : {}),
      }),
      otherDiscriminator,
    ),
  );
  event.createdFloodingSources.forEach((source, i) => {
    recs.push(
      register(
        makeRecord(battleId, {
          kind: "FLOODING_SOURCE",
          battleMinute: event.battleMinute,
          substep: event.substep,
          sourceId: source.compartmentId,
          targetId: `${source.compartmentId}:${source.cause}:${i}`,
          commandSource: command,
          legalContactId: target.contactId,
          torpedoModelId: track.torpedoModelId,
          launcherId: track.launcherId,
          settingId: track.selectedSettingId,
          solutionInputs: solution?.inputs ?? [],
          solutionQualityBp: solution?.qualityBp ?? null,
          damageEffects: {
            ...NEUTRAL_DAMAGE_EFFECTS,
            structuralDamage: 0,
            floodingSourcesCreated: 1,
            reasonCode: source.cause,
          },
          persists: true,
          discriminator: floodDiscriminator,
        }),
        floodDiscriminator,
      ),
    );
  });
  if (result.machineryEffect?.reasonCode) {
    recs.push(
      register(
        makeRecord(battleId, {
          kind: "MACHINERY",
          battleMinute: event.battleMinute,
          substep: event.substep,
          sourceId: event.torpedoTrackId,
          targetId: firstStableSystemIdOf(result.machineryEffect),
          commandSource: command,
          legalContactId: target.contactId,
          torpedoModelId: track.torpedoModelId,
          launcherId: track.launcherId,
          settingId: track.selectedSettingId,
          solutionInputs: solution?.inputs ?? [],
          solutionQualityBp: solution?.qualityBp ?? null,
          rngDecision: {
            streamId: result.machineryEffect.decision.streamId,
            draw: result.machineryEffect.decision.draw,
            drawBp: result.machineryEffect.decision.drawBp,
          },
          damageEffects: {
            ...NEUTRAL_DAMAGE_EFFECTS,
            reasonCode: result.machineryEffect.reasonCode,
          },
          persists: true,
          ...(otherDiscriminator ? { discriminator: otherDiscriminator } : {}),
        }),
        otherDiscriminator,
      ),
    );
  }
  if (result.systemShockResult?.affectedSystem) {
    recs.push(
      register(
        makeRecord(battleId, {
          kind: "SYSTEM_SHOCK",
          battleMinute: event.battleMinute,
          substep: event.substep,
          sourceId: event.torpedoTrackId,
          targetId: result.systemShockResult.affectedSystem!.stableSystemId,
          commandSource: command,
          legalContactId: target.contactId,
          torpedoModelId: track.torpedoModelId,
          launcherId: track.launcherId,
          settingId: track.selectedSettingId,
          solutionInputs: solution?.inputs ?? [],
          solutionQualityBp: solution?.qualityBp ?? null,
          rngDecision: result.systemShockResult.decision
            ? {
                streamId: result.systemShockResult.decision.streamId,
                draw: result.systemShockResult.decision.draw,
                drawBp: result.systemShockResult.decision.drawBp,
              }
            : null,
          damageEffects: {
            ...NEUTRAL_DAMAGE_EFFECTS,
            reasonCode: result.systemShockResult.reasonCode,
          },
          persists: true,
          ...(otherDiscriminator ? { discriminator: otherDiscriminator } : {}),
        }),
        otherDiscriminator,
      ),
    );
  }
  if (result.tubeHazardResult?.reasonCode) {
    recs.push(
      register(
        makeRecord(battleId, {
          kind: "TUBE_HAZARD",
          battleMinute: event.battleMinute,
          substep: event.substep,
          sourceId: event.torpedoTrackId,
          targetId: `launcher:${track.launcherId}`,
          commandSource: command,
          legalContactId: target.contactId,
          torpedoModelId: track.torpedoModelId,
          launcherId: track.launcherId,
          settingId: track.selectedSettingId,
          solutionInputs: solution?.inputs ?? [],
          solutionQualityBp: solution?.qualityBp ?? null,
          rngDecision: result.tubeHazardResult.decision
            ? {
                streamId: result.tubeHazardResult.decision.streamId,
                draw: result.tubeHazardResult.decision.draw,
                drawBp: result.tubeHazardResult.decision.drawBp,
              }
            : null,
          damageEffects: {
            ...NEUTRAL_DAMAGE_EFFECTS,
            floodingSourcesCreated: result.tubeHazardResult.extraFloodingSource ? 1 : 0,
            reasonCode: result.tubeHazardResult.reasonCode,
            terminalTransition: null,
          },
          persists: true,
          ...(otherDiscriminator ? { discriminator: otherDiscriminator } : {}),
        }),
        otherDiscriminator,
      ),
    );
  }
  return recs;
}

export function firstStableSystemIdOf(machinery: {
  componentEffects: readonly { componentId: string }[];
}): string {
  return machinery.componentEffects[0]?.componentId ?? "machinery-space";
}
