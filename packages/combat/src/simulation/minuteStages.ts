import type { MovementState } from "../movement/neighbour.js";
import {
  advancePosition,
  resolveCollisionsGrounding,
  resolvePropulsion,
  resolveTurning,
} from "../movement/neighbour.js";
import { SUBSTEPS_PER_MINUTE } from "../core/tacticalTime.js";
import {
  resolveSensorsSpotting,
  type Position,
  type SensorObserver,
  type TrueAsset,
} from "../spotting/detection.js";
import {
  ageContact,
  createContactTrack,
  isStale,
  updateContact,
  type TacticalContact,
} from "../contact/neighbour.js";
import type { BattleEvent } from "../core/battleLedger.js";
import { BattleLedger } from "../core/battleLedger.js";
import { resolveGunnery, type GunneryEventRecord, type GunneryState } from "../gunnery/index.js";
import { resolveWeather } from "../weather/engine.js";
import type { BattleWeatherComponents } from "../weather/components.js";
import type { TacticalBattleState } from "../tactical/index.js";
import type { ShipDamageState } from "../damage/state.js";
import { resolveMinuteDamage } from "../damage/minuteDamage.js";
import {
  resolveTorpedoes,
  type TorpedoLauncherState,
  type TorpedoRecord,
  type TorpedoTrack,
} from "../torpedoes/index.js";
import { resolveSmoke, type SmokeCloud, type SmokeEventRecord } from "../smoke/engineWiring.js";
import {
  applyDamageControlToState,
  requireDamageDesignSurface,
  resolveDamageControl,
} from "../damage/damageControlEngineWiring.js";
import { resolveAirCombat, type AirCombatRecord } from "../air-combat/engineWiring.js";
import {
  resolveAirDefense,
  type AirDefenseEngagementRecord,
  type AirDefenseState,
} from "../air-defense/engineWiring.js";
import type { AdvanceMinuteInput, UnitOrders } from "./engine.js";

export const DAMAGE_CONTROL_SUBSTEP = 57 as const;

type Unit = NonNullable<TacticalBattleState["units"]>[number];

export interface UnitRun {
  assetId: string;
  movement: MovementState;
}

export interface MinuteRun {
  input: AdvanceMinuteInput;
  battleId: string;
  minute: number;
  ledger: BattleLedger;
  units: readonly Unit[];
  movement: Record<string, MovementState>;
  run: UnitRun[];
  contacts: TacticalContact[];
  before: string[];
  orders: Record<string, UnitOrders>;
  resolvedMovements: Record<string, MovementState>;
  collisionRecord: { empty: boolean };
  smokeClouds?: SmokeCloud[];
  smokeRecords?: SmokeEventRecord[];
  weatherComponents?: BattleWeatherComponents;
  airCombatRecords?: readonly AirCombatRecord[];
  airCombatSummary?: { capEngagements: number; strikeAttacks: number; losses: number };
  airDefenseRecords?: readonly AirDefenseEngagementRecord[];
  airDefenseStates?: Readonly<Record<string, AirDefenseState>>;
  afterContacts: TacticalContact[];
  byKey: Map<string, TacticalContact>;
  shipPositions: Record<string, Position>;
  gunneryStates?: Record<string, GunneryState>;
  salvos: readonly GunneryEventRecord[];
  damageStates?: Record<string, ShipDamageState>;
  torpedoStates?: Record<string, TorpedoLauncherState>;
  torpedoTracks?: readonly TorpedoTrack[];
  torpedoRecords?: readonly TorpedoRecord[];
}

export function evt(
  minute: number,
  substep: number,
  eventType: string,
  priority: number,
  actorId: string,
  battleId: string,
  targetId = "",
): BattleEvent {
  const eventId = `${battleId}:${minute}:${substep}:${eventType}:${actorId}:${targetId}`;
  return {
    battleId,
    minute,
    substep,
    eventPriority: priority,
    actorId,
    targetId,
    eventId,
    eventType,
  };
}

export function cloneMovementState(m: MovementState): MovementState {
  return { ...m, ...(m.position ? { position: [m.position[0], m.position[1]] } : {}) };
}

export function updateContactKnowledge(run: MinuteRun): void {
  run.contacts = (run.input.state.contacts ?? []).map((c) => ageContact(c, 1));
  run.before = run.contacts
    .filter((c) => !isStale(c))
    .map((c) => c.contactId)
    .sort();
  run.contacts = run.contacts.filter((c) => !isStale(c));
  run.ledger.append(evt(run.minute, 0, "update_contact_knowledge", 4, "pipeline", run.battleId));
}

export function resolveMovementIntent(run: MinuteRun): void {
  for (const u of run.run) {
    const ord = run.orders[u.assetId];
    const next: MovementState = {
      ...u.movement,
      orderedSpeed: ord?.orderedSpeedBp ?? u.movement.orderedSpeed,
    };
    run.resolvedMovements[u.assetId] = next;
    u.movement = next;
  }
  run.ledger.append(evt(run.minute, 0, "resolve_movement_intent", 5, "pipeline", run.battleId));
}

export function resolveSmokeStage(run: MinuteRun): void {
  if (!run.input.smoke) return;
  const smokeResult = resolveSmoke(run.input.smoke, run.minute, 0);
  if (smokeResult.nextClouds.length > 0 || smokeResult.events.length > 0) {
    run.smokeClouds = smokeResult.nextClouds;
    run.smokeRecords = smokeResult.events;
    for (const sr of smokeResult.events) {
      run.ledger.append(
        evt(
          run.minute,
          0,
          `smoke_${sr.kind.toLowerCase()}`,
          55,
          `cloud-${sr.cloudId}`,
          run.battleId,
        ),
      );
    }
  }
}

export function resolvePropulsionStage(run: MinuteRun): void {
  for (let sub = 0; sub < SUBSTEPS_PER_MINUTE; sub++) {
    for (const u of run.run) {
      const ord = run.orders[u.assetId];
      const m = u.movement;
      m.currentSpeed = resolvePropulsion({
        currentSpeed: m.currentSpeed,
        orderedSpeed: m.orderedSpeed,
        dtSeconds: 1,
        attainableMaxBpKnots: ord?.attainableMaxBp ?? m.orderedSpeed,
      });
      m.heading = resolveTurning({
        heading: m.heading,
        orderedHeading: ord?.orderedHeading ?? m.heading,
        dtSeconds: 1,
        turningRateMdegS: m.turningRate,
      });
      m.position = advancePosition({
        state: { ...m, currentSpeed: m.currentSpeed, heading: m.heading },
        dtSeconds: 1,
      });
    }
  }
  for (const u of run.run) run.resolvedMovements[u.assetId] = { ...u.movement };
  run.ledger.append(
    evt(run.minute, 0, "resolve_propulsion_formation", 6, "pipeline", run.battleId),
  );
}

export function resolveCollisionsStage(run: MinuteRun): void {
  run.collisionRecord = resolveCollisionsGrounding();
  run.ledger.append(
    evt(run.minute, 0, "resolve_collisions_grounding", 7, "pipeline", run.battleId),
  );
}

export function resolveWeatherStage(run: MinuteRun): void {
  if (!run.input.weather) return;
  const weatherResult = resolveWeather({
    context: run.input.weather,
    battleId: run.battleId,
    minute: run.minute,
  });
  for (const we of weatherResult.ledgerEvents) run.ledger.append(we);
  run.weatherComponents = weatherResult.nextComponents;
}

export function resolveAirCombatStage(run: MinuteRun): void {
  if (!run.input.airCombat) return;
  const airResult = resolveAirCombat({
    ...run.input.airCombat,
    battleId: run.battleId,
    minute: run.minute,
  });
  if (airResult.active && airResult.records.length > 0) {
    run.airCombatRecords = airResult.records;
    run.airCombatSummary = airResult.summary;
  }
}

export function resolveAirDefenseStage(run: MinuteRun): void {
  if (!run.input.airDefense) return;
  const adResult = resolveAirDefense(run.input.airDefense, run.battleId, run.minute);
  if (adResult.records.length > 0) {
    run.airDefenseRecords = adResult.records;
    run.airDefenseStates = adResult.nextStates;
  }
}

export function resolveSensorsStage(run: MinuteRun): void {
  const observers: SensorObserver[] = run.units.map((u) => ({
    observerId: `obs-${u.assetId}`,
    sideId: u.sideId,
    position: run.resolvedMovements[u.assetId]!.position,
  }));
  const assets: TrueAsset[] = run.units.map((u) => ({
    assetId: u.assetId,
    sideId: u.sideId,
    position: run.resolvedMovements[u.assetId]!.position,
    heading: run.resolvedMovements[u.assetId]!.heading,
    speedBpKnots: run.resolvedMovements[u.assetId]!.currentSpeed,
    estimatedClass: u.className,
  }));
  const detected = resolveSensorsSpotting({
    observers,
    assets,
    battleId: run.battleId,
    minute: run.minute,
    observationTime: run.input.observationTime,
    contractRangeUm: run.input.attackRangeUm,
  });
  const byKey = new Map(run.contacts.map((c) => [c.contactId, c]));
  const seen = new Set<string>();
  for (const d of detected) {
    const key = d.contactId;
    seen.add(key);
    const existing = byKey.get(key);
    if (existing) {
      const merged: TacticalContact = updateContact(existing, {
        position: d.position,
        course: d.course,
        speedBpKnots: d.speed,
        observationTime: d.observationTime,
        minute: run.minute,
        source: d.source,
      });
      byKey.set(key, merged);
      run.ledger.append(evt(run.minute, 1, "contact_updated", 8, `obs-${key}`, run.battleId, key));
    } else {
      const created = createContactTrack({
        battleId: run.battleId,
        assetId: d.assetId,
        sideId: d.sideId,
        estimatedIdentity: d.estimatedIdentity,
        position: d.position,
        course: d.course,
        speedBpKnots: d.speed,
        observationTime: d.observationTime,
        minute: run.minute,
        source: d.source,
      });
      byKey.set(key, created);
      run.ledger.append(evt(run.minute, 0, "contact_created", 8, `obs-${key}`, run.battleId, key));
    }
  }
  run.afterContacts = [...byKey.values()];
  run.byKey = byKey;
  run.ledger.append(evt(run.minute, 0, "resolve_sensors_spotting", 8, "pipeline", run.battleId));
}

export function buildShipPositions(run: MinuteRun): void {
  const shipPositions: Record<string, Position> = {};
  for (const u of run.units) {
    const m = run.resolvedMovements[u.assetId];
    if (!m) continue;
    shipPositions[u.assetId] = m.position;
  }
  run.shipPositions = shipPositions;
}

export function resolveGunneryStage(run: MinuteRun): void {
  const gunneryBatteries = run.input.gunnery ?? [];
  if (gunneryBatteries.length === 0) return;
  const gres = resolveGunnery({
    battleId: run.battleId,
    minute: run.minute,
    batteries: gunneryBatteries,
    contacts: run.afterContacts,
    engine: run.input.engine,
    shipPositions: run.shipPositions,
  });
  for (const ge of gres.events) run.ledger.append(ge);
  run.gunneryStates = gres.nextStates;
  run.salvos = gres.salvos;
}

export function resolveDamageStage(run: MinuteRun): void {
  if (!run.input.damage) return;
  const dmgResult = resolveMinuteDamage({
    battleId: run.battleId,
    minute: run.minute,
    salvos: run.salvos,
    contacts: run.afterContacts,
    targets: run.input.damage.targets,
    engine: run.input.damage.engine,
    randomLedger: run.input.damage.randomLedger,
  });
  for (const de of dmgResult.events) run.ledger.append(de);
  if (Object.keys(dmgResult.states).length > 0) run.damageStates = dmgResult.states;
}

export function resolveTorpedoStage(run: MinuteRun): void {
  if (!run.input.torpedoes) return;
  const { battleId, minute, units, resolvedMovements, afterContacts, shipPositions } = run;
  const shipHeadings: Record<string, number> = {};
  const shipSpeedsUmS: Record<string, number> = {};
  for (const u of units) {
    const m = resolvedMovements[u.assetId];
    if (!m) continue;
    shipHeadings[u.assetId] = m.heading;
    shipSpeedsUmS[u.assetId] = m.currentSpeed;
  }
  let torpedoContext = run.input.torpedoes;
  if (run.damageStates && Object.keys(run.damageStates).length > 0) {
    torpedoContext = { ...run.input.torpedoes, targets: { ...run.input.torpedoes.targets } };
    for (const [sid, st] of Object.entries(run.damageStates)) {
      const tgt = torpedoContext.targets[sid];
      if (tgt) torpedoContext.targets[sid] = { ...tgt, damageState: st };
    }
  }
  const torpedoResult = resolveTorpedoes({
    battleId,
    minute,
    context: torpedoContext,
    contacts: afterContacts,
    shipPositions,
    shipHeadings,
    shipSpeedsUmS,
    engine: run.input.engine,
  });
  if (!torpedoResult.changed) return;
  for (const te of torpedoResult.events) run.ledger.append(te);
  run.torpedoRecords = torpedoResult.records.length > 0 ? torpedoResult.records : undefined;
  run.torpedoTracks = torpedoResult.tracks.length > 0 ? torpedoResult.tracks : undefined;
  if (Object.keys(torpedoResult.launcherStates).length > 0)
    run.torpedoStates = torpedoResult.launcherStates;
  if (Object.keys(torpedoResult.damageStates).length > 0)
    run.damageStates = { ...run.damageStates, ...torpedoResult.damageStates };
}

export function resolveDamageControlStage(run: MinuteRun): void {
  if (!run.input.damageControl) return;
  const damageControlMap = run.input.damageControl;
  const dcShipIds = Object.keys(damageControlMap).sort();
  for (const shipId of dcShipIds) {
    const dcContext = damageControlMap[shipId]!;
    const baseState = run.damageStates?.[shipId] ?? run.input.damage?.targets[shipId]?.state;
    if (!baseState) continue;
    const dcResult = resolveDamageControl(
      {
        ...dcContext,
        shipId,
        fireRecords: [...baseState.fireRecords],
        floodingRecords: [...baseState.floodingRecords],
        floodedWaterBp: baseState.progressiveFloodingTotal,
      },
      run.minute,
      DAMAGE_CONTROL_SUBSTEP,
    );
    for (const _sr of dcResult.smokeEventRecords) {
      run.ledger.append(
        evt(
          run.minute,
          DAMAGE_CONTROL_SUBSTEP,
          "smoke_fire",
          86,
          `fire-smoke:${shipId}`,
          run.battleId,
          _sr.sourceId,
        ),
      );
    }
    const design = requireDamageDesignSurface(
      run.input.damage?.targets[shipId],
      run.battleId,
      shipId,
    );
    const written = applyDamageControlToState({
      state: baseState,
      stageResult: dcResult,
      designFlotationReserve: design.designFlotationReserve,
      designStabilityScore: design.designStabilityScore,
    });
    if (written.changed) {
      if (!run.damageStates) run.damageStates = {};
      run.damageStates[shipId] = written.state;
    }
  }
}
