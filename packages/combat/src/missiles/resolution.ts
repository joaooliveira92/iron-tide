import type { RandomEngine, RandomLedger } from "@bluewave/random";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

import type { BattleEvent } from "../core/battleLedger.js";
import type { Position } from "../core/position.js";
import type { GunneryImpact } from "../damage/engineWiring.js";
import { FLOAT_UNIT, STABILITY_INITIAL_BP } from "../damage/minuteDamageConstants.js";
import {
  MISSILE_BASIS_POINTS,
  MISSILE_DAMAGE_HIT_LOCATION,
  MISSILE_FORMULA_VERSION,
  MISSILE_IMPACT_EVENT_TYPE,
  MISSILE_IMPACT_PRIORITY,
  MISSILE_LAUNCH_EVENT_TYPE,
  MISSILE_LAUNCH_PRIORITY,
  MISSILE_MICROMETRES_PER_METRE,
  MISSILE_RULESET_VERSION,
  MISSILE_SECONDS_PER_MINUTE,
  MISSILE_SUBSTEP,
  type MissileRules,
  type SsmMissileClass,
} from "./constants.js";
import {
  type MissileContext,
  type MissileLauncherState,
  type MissileSalvoInFlight,
  withMissileLauncherStateHash,
  withMissileSalvoHash,
} from "./model.js";
import { compareMissileStrings, missileRecordOrder, missileSalvoOrder } from "./ordering.js";
import {
  MISSILE_HIT,
  MISSILE_INTERCEPTED,
  MISSILE_KEYED_DRAW,
  MISSILE_LAUNCHED,
  MISSILE_MISS,
} from "./reasonCodes.js";
import { makeMissileRecord, missileRecordId, type MissileRecord } from "./records.js";

export interface MissileTargetShip {
  readonly shipId: string;
  readonly sideId: string;
  readonly position?: Position;
  readonly operational: boolean;
}

export interface ResolveMissilesInput {
  readonly battleId: string;
  readonly minute: number;
  readonly context: MissileContext;
  readonly targets: readonly MissileTargetShip[];
  readonly engine?: RandomEngine;
  readonly randomLedger?: RandomLedger;
}

export interface MissileActivitySummary {
  readonly launches: number;
  readonly hits: number;
  readonly intercepts: number;
}

export interface MissileResolution {
  readonly records: readonly MissileRecord[];
  readonly events: readonly BattleEvent[];
  readonly launcherStates: Readonly<Record<string, MissileLauncherState>>;
  readonly inFlight: readonly MissileSalvoInFlight[];
  readonly impactsByTarget: Readonly<Record<string, readonly GunneryImpact[]>>;
  readonly changed: boolean;
  readonly summary: MissileActivitySummary;
}

function squaredDistance(
  a: readonly [number, number] | undefined,
  b: readonly [number, number] | undefined,
): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function keyedDraw(input: {
  engine: RandomEngine | undefined;
  randomLedger: RandomLedger | undefined;
  streamId: string;
  entityKey: string;
  battleId: string;
  minute: number;
  salvoId: string;
  missileOrdinal: number | null;
  reasonCode: string;
  outcome: string;
}): { draw: number; drawBp: number } {
  const draw = input.engine === undefined ? 0 : input.engine.stream(input.streamId).next();
  const drawBp = Math.floor(draw * MISSILE_BASIS_POINTS);
  input.randomLedger?.record({
    streamId: input.streamId,
    entityKey: input.entityKey,
    phase: "resolve_battle_auto_resolution_missiles",
    rulesetVersion: MISSILE_RULESET_VERSION,
    inputHash: sha256Hex(
      canonicalSerialize({
        battleId: input.battleId,
        minute: input.minute,
        salvoId: input.salvoId,
        missileOrdinal: input.missileOrdinal,
      }),
    ),
    draw,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
  });
  return { draw, drawBp };
}

function missileEvent(input: {
  battleId: string;
  minute: number;
  eventType: string;
  priority: number;
  actorId: string;
  targetId: string;
}): BattleEvent {
  return {
    battleId: input.battleId,
    minute: input.minute,
    substep: MISSILE_SUBSTEP,
    eventPriority: input.priority,
    actorId: input.actorId,
    targetId: input.targetId,
    eventId: `${input.battleId}:${input.minute}:${MISSILE_SUBSTEP}:${input.eventType}:${input.actorId}:${input.targetId}`,
    eventType: input.eventType,
  };
}

function selectTarget(
  launcher: MissileLauncherState,
  targetById: ReadonlyMap<string, MissileTargetShip>,
  rangesUm: Readonly<Record<SsmMissileClass, number>>,
): MissileTargetShip | undefined {
  const owner = targetById.get(launcher.ownerShipId);
  if (!owner || !owner.operational) return undefined;
  const maxRangeUm = rangesUm[launcher.missileClass];
  let best: MissileTargetShip | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const target of targetById.values()) {
    if (target.sideId === launcher.sideId) continue;
    if (!target.operational) continue;
    const distance = squaredDistance(owner.position, target.position);
    if (!Number.isFinite(distance) || distance > maxRangeUm * maxRangeUm) continue;
    if (
      distance < bestDistance ||
      (distance === bestDistance && best !== undefined && target.shipId < best.shipId)
    ) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

function buildImpact(salvo: MissileSalvoInFlight, rules: MissileRules): GunneryImpact {
  const classRules = rules.classes[salvo.missileClass];
  const hullBreach = classRules.flotationDamage > 0;
  return {
    sourceId: salvo.launcherId,
    weaponId: `${salvo.missileClass}_missile`,
    targetShipId: salvo.targetShipId,
    hitLocation: MISSILE_DAMAGE_HIT_LOCATION,
    penetrationOutcome: "FULL_PENETRATION",
    splinterIntensity: "MEDIUM",
    effectiveResistanceUm: 0,
    penetrationMargin: classRules.structuralDamage,
    structuralDamage: classRules.structuralDamage,
    flotationDamage: classRules.flotationDamage,
    shipType: "ORDINARY",
    hasCombustible: true,
    hasOxygen: true,
    hullBreach,
    hasWaterRoute: hullBreach,
    hasMagazineInZone: false,
    hitZoneType: MISSILE_DAMAGE_HIT_LOCATION,
    catastrophicBreakup: false,
    capsizeRisk: false,
    designFlotationReserve: FLOAT_UNIT,
    designStabilityScore: STABILITY_INITIAL_BP,
  };
}

export function resolveMissiles(input: ResolveMissilesInput): MissileResolution {
  const { battleId, minute, context, engine, randomLedger } = input;
  if (context.launchers.length === 0 && context.inFlight.length === 0) {
    return {
      records: [],
      events: [],
      launcherStates: {},
      inFlight: [],
      impactsByTarget: {},
      changed: false,
      summary: { launches: 0, hits: 0, intercepts: 0 },
    };
  }

  const targetById = new Map(input.targets.map((target) => [target.shipId, target] as const));
  const rangesUm = {
    light_ssm: context.rules.classes.light_ssm.rangeM * MISSILE_MICROMETRES_PER_METRE,
    medium_ssm: context.rules.classes.medium_ssm.rangeM * MISSILE_MICROMETRES_PER_METRE,
    heavy_ssm: context.rules.classes.heavy_ssm.rangeM * MISSILE_MICROMETRES_PER_METRE,
  } as const;

  const records: MissileRecord[] = [];
  const events: BattleEvent[] = [];
  const impactsByTarget: Record<string, GunneryImpact[]> = {};
  const remaining: MissileSalvoInFlight[] = [];
  let hits = 0;
  let intercepts = 0;

  const arriving = [...context.inFlight]
    .filter((salvo) => salvo.impactMinute === minute)
    .sort(missileSalvoOrder);
  const pending = [...context.inFlight]
    .filter((salvo) => salvo.impactMinute !== minute)
    .sort(missileSalvoOrder);
  remaining.push(...pending);

  for (const salvo of arriving) {
    const classRules = context.rules.classes[salvo.missileClass];
    const interceptStreamId = `missile/intercept:${battleId}:${salvo.salvoId}`;
    const intercept = keyedDraw({
      engine,
      randomLedger,
      streamId: interceptStreamId,
      entityKey: salvo.launcherId,
      battleId,
      minute,
      salvoId: salvo.salvoId,
      missileOrdinal: null,
      reasonCode: MISSILE_KEYED_DRAW,
      outcome: "INTERCEPT_CHECK",
    });
    if (intercept.drawBp < classRules.defenceInterceptBp) {
      intercepts += 1;
      records.push(
        makeMissileRecord({
          recordId: missileRecordId({
            battleId,
            minute,
            substep: MISSILE_SUBSTEP,
            kind: "INTERCEPT",
            salvoId: salvo.salvoId,
            missileOrdinal: 0,
          }),
          kind: "INTERCEPT",
          battleMinute: minute,
          substep: MISSILE_SUBSTEP,
          salvoId: salvo.salvoId,
          launcherId: salvo.launcherId,
          ownerShipId: salvo.ownerShipId,
          sideId: salvo.sideId,
          missileClass: salvo.missileClass,
          targetShipId: salvo.targetShipId,
          missiles: salvo.missiles,
          streamId: interceptStreamId,
          draw: intercept.draw,
          drawBp: intercept.drawBp,
          outcome: "INTERCEPTED",
          reasonCode: MISSILE_INTERCEPTED,
          formulaVersion: MISSILE_FORMULA_VERSION,
          rulesetVersion: MISSILE_RULESET_VERSION,
        }),
      );
      events.push(
        missileEvent({
          battleId,
          minute,
          eventType: MISSILE_IMPACT_EVENT_TYPE,
          priority: MISSILE_IMPACT_PRIORITY,
          actorId: salvo.launcherId,
          targetId: salvo.targetShipId,
        }),
      );
      continue;
    }

    const impacts: GunneryImpact[] = [];
    for (let ordinal = 0; ordinal < salvo.missiles; ordinal++) {
      const hitStreamId = `missile/hit:${battleId}:${salvo.salvoId}:${String(ordinal)}`;
      const draw = keyedDraw({
        engine,
        randomLedger,
        streamId: hitStreamId,
        entityKey: salvo.launcherId,
        battleId,
        minute,
        salvoId: salvo.salvoId,
        missileOrdinal: ordinal,
        reasonCode: MISSILE_KEYED_DRAW,
        outcome: "HIT_CHECK",
      });
      const hit = draw.drawBp < classRules.baseHitBp;
      if (hit) {
        hits += 1;
        impacts.push(buildImpact(salvo, context.rules));
      }
      records.push(
        makeMissileRecord({
          recordId: missileRecordId({
            battleId,
            minute,
            substep: MISSILE_SUBSTEP,
            kind: hit ? "HIT" : "MISS",
            salvoId: salvo.salvoId,
            missileOrdinal: ordinal,
          }),
          kind: hit ? "HIT" : "MISS",
          battleMinute: minute,
          substep: MISSILE_SUBSTEP,
          salvoId: salvo.salvoId,
          launcherId: salvo.launcherId,
          ownerShipId: salvo.ownerShipId,
          sideId: salvo.sideId,
          missileClass: salvo.missileClass,
          targetShipId: salvo.targetShipId,
          missiles: 1,
          streamId: hitStreamId,
          draw: draw.draw,
          drawBp: draw.drawBp,
          outcome: hit ? "HIT" : "MISS",
          reasonCode: hit ? MISSILE_HIT : MISSILE_MISS,
          formulaVersion: MISSILE_FORMULA_VERSION,
          rulesetVersion: MISSILE_RULESET_VERSION,
        }),
      );
    }
    if (impacts.length > 0) {
      const accumulated = impactsByTarget[salvo.targetShipId] ?? [];
      impactsByTarget[salvo.targetShipId] = [...accumulated, ...impacts];
    }
    events.push(
      missileEvent({
        battleId,
        minute,
        eventType: MISSILE_IMPACT_EVENT_TYPE,
        priority: MISSILE_IMPACT_PRIORITY,
        actorId: salvo.launcherId,
        targetId: salvo.targetShipId,
      }),
    );
  }

  let launches = 0;
  const launcherStates: Record<string, MissileLauncherState> = {};
  const launchers = [...context.launchers].sort((a, b) =>
    compareMissileStrings(a.launcherId, b.launcherId),
  );
  for (const launcher of launchers) {
    const target = selectTarget(launcher, targetById, rangesUm);
    let next = launcher;
    if (target !== undefined && launcher.salvosFired < launcher.maxSalvos) {
      const classRules = context.rules.classes[launcher.missileClass];
      const salvoId = `${launcher.launcherId}:${String(minute)}:${String(launcher.salvosFired + 1)}`;
      const impactMinute =
        minute + Math.max(1, Math.ceil(classRules.flightTimeSeconds / MISSILE_SECONDS_PER_MINUTE));
      const salvo = withMissileSalvoHash({
        salvoId,
        launcherId: launcher.launcherId,
        ownerShipId: launcher.ownerShipId,
        sideId: launcher.sideId,
        missileClass: launcher.missileClass,
        targetShipId: target.shipId,
        launchMinute: minute,
        impactMinute,
        missiles: classRules.salvoSize,
      });
      remaining.push(salvo);
      launches += 1;
      next = withMissileLauncherStateHash({
        launcherId: launcher.launcherId,
        ownerShipId: launcher.ownerShipId,
        sideId: launcher.sideId,
        missileClass: launcher.missileClass,
        salvosFired: launcher.salvosFired + 1,
        maxSalvos: launcher.maxSalvos,
      });
      records.push(
        makeMissileRecord({
          recordId: missileRecordId({
            battleId,
            minute,
            substep: MISSILE_SUBSTEP,
            kind: "LAUNCH",
            salvoId,
            missileOrdinal: 0,
          }),
          kind: "LAUNCH",
          battleMinute: minute,
          substep: MISSILE_SUBSTEP,
          salvoId,
          launcherId: launcher.launcherId,
          ownerShipId: launcher.ownerShipId,
          sideId: launcher.sideId,
          missileClass: launcher.missileClass,
          targetShipId: target.shipId,
          missiles: classRules.salvoSize,
          streamId: null,
          draw: null,
          drawBp: null,
          outcome: "LAUNCHED",
          reasonCode: MISSILE_LAUNCHED,
          formulaVersion: MISSILE_FORMULA_VERSION,
          rulesetVersion: MISSILE_RULESET_VERSION,
        }),
      );
      events.push(
        missileEvent({
          battleId,
          minute,
          eventType: MISSILE_LAUNCH_EVENT_TYPE,
          priority: MISSILE_LAUNCH_PRIORITY,
          actorId: launcher.launcherId,
          targetId: target.shipId,
        }),
      );
    }
    launcherStates[launcher.launcherId] = next;
  }

  const sortedRecords = [...records].sort(missileRecordOrder);
  const sortedRemaining = [...remaining].sort(missileSalvoOrder);
  const changed =
    sortedRecords.length > 0 ||
    sortedRemaining.length !== context.inFlight.length ||
    launchers.some((launcher) => launcherStates[launcher.launcherId] !== launcher);

  return {
    records: sortedRecords,
    events,
    launcherStates,
    inFlight: sortedRemaining,
    impactsByTarget,
    changed,
    summary: { launches, hits, intercepts },
  };
}
