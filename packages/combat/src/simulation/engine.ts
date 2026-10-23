import type { RandomEngine } from "@bluewave/random";
import type { MovementState } from "../movement/neighbour.js";
import { BattleLedger, type BattleEvent } from "../core/battleLedger.js";
import type { TacticalContact } from "../contact/neighbour.js";
import type { GunneryBattery, GunneryState } from "../gunnery/index.js";
import type { GunneryEventRecord } from "../gunnery/event.js";
import type { BattleWeatherComponents, WeatherEngineContext } from "../weather/neighbour.js";
import type { TacticalBattleState } from "../tactical/index.js";
import type { ShipDamageState } from "../damage/state.js";
import type { DamageContext } from "../damage/minuteDamage.js";
import type {
  TorpedoContext,
  TorpedoLauncherState,
  TorpedoRecord,
  TorpedoTrack,
} from "../torpedoes/index.js";
import {
  type SmokeContext,
  type SmokeCloud,
  type SmokeEventRecord,
} from "../smoke/engineWiring.js";
import type { DamageControlContext } from "../damage/damageControlEngineWiring.js";
import { type AirCombatContext, type AirCombatRecord } from "../air-combat/engineWiring.js";
import {
  type AirDefenseContext,
  type AirDefenseEngagementRecord,
  type AirDefenseState,
} from "../air-defense/engineWiring.js";
import {
  buildShipPositions,
  cloneMovementState,
  resolveAirCombatStage,
  resolveAirDefenseStage,
  resolveCollisionsStage,
  resolveDamageControlStage,
  resolveDamageStage,
  resolveGunneryStage,
  resolveMovementIntent,
  resolvePropulsionStage,
  resolveSensorsStage,
  resolveSmokeStage,
  resolveTorpedoStage,
  resolveWeatherStage,
  updateContactKnowledge,
  type MinuteRun,
  type UnitRun,
} from "./minuteStages.js";
import { buildMinuteResult } from "./minuteResult.js";

export { DAMAGE_CONTROL_SUBSTEP } from "./minuteStages.js";

export interface UnitOrders {
  orderedHeading: number;
  orderedSpeedBp: number;
  attainableMaxBp?: number;
}

export interface AdvanceMinuteInput {
  state: TacticalBattleState;
  minute: number;
  observationTime: string;
  orders?: Record<string, UnitOrders>;
  attackRangeUm?: number;
  engine?: RandomEngine;
  gunnery?: GunneryBattery[];
  weather?: WeatherEngineContext;
  damage?: DamageContext;
  torpedoes?: TorpedoContext;
  smoke?: SmokeContext;
  damageControl?: Record<string, DamageControlContext>;
  airCombat?: AirCombatContext;
  airDefense?: AirDefenseContext;
}

export interface MinuteResult {
  minute: number;
  movementStates: Record<string, MovementState>;
  contacts: TacticalContact[];
  events: BattleEvent[];
  minuteHash: string;
  gunneryStates?: Record<string, GunneryState>;
  gunneryRecords?: readonly GunneryEventRecord[];
  weatherComponents?: BattleWeatherComponents;
  damageStates?: Record<string, ShipDamageState>;
  torpedoStates?: Record<string, TorpedoLauncherState>;
  torpedoTracks?: readonly TorpedoTrack[];
  torpedoRecords?: readonly TorpedoRecord[];
  smokeClouds?: SmokeCloud[];
  smokeRecords?: SmokeEventRecord[];
  airCombatRecords?: readonly AirCombatRecord[];
  airCombatSummary?: { capEngagements: number; strikeAttacks: number; losses: number };
  airDefenseRecords?: readonly AirDefenseEngagementRecord[];
  airDefenseStates?: Readonly<Record<string, AirDefenseState>>;
}

export function advanceMinute(input: AdvanceMinuteInput): MinuteResult {
  const { battleId } = input.state;
  const minute = input.minute;
  const ledger = new BattleLedger();
  const units = input.state.units ?? [];

  const movement: Record<string, MovementState> = {};
  for (const [k, v] of Object.entries(input.state.movementStates ?? {})) {
    movement[k] = cloneMovementState(v);
  }
  const run: UnitRun[] = units.map((u) => {
    const m = movement[u.assetId] ?? {
      position: [0, 0],
      heading: 0,
      orderedSpeed: 0,
      currentSpeed: 0,
      acceleration: 0,
      turningRate: 1_000,
      collisionRadius: 5_000_000,
      propulsionState: "steam",
      machineryReliability: 10_000,
      fuelState: "coal",
      formationStation: "LEAD",
    };
    return { assetId: u.assetId, movement: m };
  });

  const ctx: MinuteRun = {
    input,
    battleId,
    minute,
    ledger,
    units,
    movement,
    run,
    contacts: [],
    before: [],
    orders: input.orders ?? {},
    resolvedMovements: {},
    collisionRecord: { empty: true },
    afterContacts: [],
    byKey: new Map(),
    shipPositions: {},
    salvos: [],
  };

  updateContactKnowledge(ctx);
  resolveMovementIntent(ctx);
  resolveSmokeStage(ctx);
  resolvePropulsionStage(ctx);
  resolveCollisionsStage(ctx);
  resolveWeatherStage(ctx);
  resolveAirCombatStage(ctx);
  resolveAirDefenseStage(ctx);
  resolveSensorsStage(ctx);
  buildShipPositions(ctx);
  resolveGunneryStage(ctx);
  resolveDamageStage(ctx);
  resolveTorpedoStage(ctx);
  resolveDamageControlStage(ctx);
  return buildMinuteResult(ctx);
}

export interface AdvanceMinutesInput {
  state: TacticalBattleState;
  minutes: number;
  observationTime: string;
  orders?: Record<string, UnitOrders>;
  attackRangeUm?: number;
  engine?: RandomEngine;
  gunnery?: GunneryBattery[];
  weather?: WeatherEngineContext;
  damage?: DamageContext;
  torpedoes?: TorpedoContext;
  smoke?: SmokeContext;
  damageControl?: Record<string, DamageControlContext>;
  airCombat?: AirCombatContext;
  airDefense?: AirDefenseContext;
}
export interface AdvanceMinutesResult {
  results: MinuteResult[];
  hashes: string[];
  finalState: TacticalBattleState;
  damageStates?: Record<string, ShipDamageState>[];
  torpedoTracks?: (readonly TorpedoTrack[])[];
}
export function advanceMinutes(input: AdvanceMinutesInput): AdvanceMinutesResult {
  const results: MinuteResult[] = [];
  let gunnery = input.gunnery;
  let weather = input.weather;
  let damage = input.damage;
  let torpedoes = input.torpedoes;
  let smoke = input.smoke;
  let damageControl = input.damageControl;
  let airCombat: AirCombatContext | undefined = input.airCombat
    ? { ...input.airCombat }
    : undefined;
  let airDefense = input.airDefense;
  let state: TacticalBattleState = {
    ...input.state,
    contacts: [...(input.state.contacts ?? [])],
    movementStates: { ...input.state.movementStates },
  };
  for (let minute = 1; minute <= input.minutes; minute++) {
    const res = advanceMinute({
      state,
      minute,
      observationTime: input.observationTime,
      orders: input.orders,
      attackRangeUm: input.attackRangeUm,
      engine: input.engine,
      gunnery,
      weather,
      damage,
      torpedoes,
      smoke,
      damageControl,
      airCombat,
      airDefense,
    });
    results.push(res);
    state = {
      ...state,
      contacts: res.contacts.map((c) => ({ ...c })),
      movementStates: Object.fromEntries(
        Object.entries(res.movementStates).map(([k, v]) => [k, { ...v }]),
      ),
    };
    if (res.gunneryStates && gunnery) {
      gunnery = gunnery.map((b) => {
        const ns = res.gunneryStates![b.id];
        return ns ? { ...b, state: ns } : b;
      });
    }
    if (res.weatherComponents && weather) {
      weather = { ...weather, components: res.weatherComponents };
    }
    if (res.damageStates && damage) {
      damage = { ...damage, targets: { ...damage.targets } };
      for (const [sid, st] of Object.entries(res.damageStates)) {
        if (damage.targets[sid]) damage.targets[sid] = { ...damage.targets[sid]!, state: st };
      }
    }
    if (torpedoes) {
      if (res.torpedoStates) {
        torpedoes = {
          ...torpedoes,
          launchers: torpedoes.launchers.map((wiring) => {
            const next = res.torpedoStates![wiring.launcher.launcherId];
            return next ? { ...wiring, launcher: next } : wiring;
          }),
        };
      }
      if (res.torpedoTracks) {
        torpedoes = {
          ...torpedoes,
          tracks: res.torpedoTracks.map((t) => ({ ...t })),
        };
      }
      if (res.damageStates) {
        torpedoes = { ...torpedoes, targets: { ...torpedoes.targets } };
        for (const [sid, st] of Object.entries(res.damageStates)) {
          const tgt = torpedoes.targets[sid];
          if (tgt) torpedoes.targets[sid] = { ...tgt, damageState: st };
        }
      }
    }
    if (smoke && res.smokeClouds) {
      smoke = { ...smoke, clouds: res.smokeClouds };
    }
    if (damageControl && res.damageStates) {
      let rebased = false;
      const nextMap = { ...damageControl };
      for (const [sid, st] of Object.entries(res.damageStates)) {
        const ctx = nextMap[sid];
        if (!ctx) continue;
        rebased = true;
        nextMap[sid] = {
          ...ctx,
          fireRecords: [...st.fireRecords],
          floodingRecords: [...st.floodingRecords],
          floodedWaterBp: st.progressiveFloodingTotal,
        };
      }
      if (rebased) damageControl = nextMap;
    }
    if (airCombat) {
      if (res.airCombatRecords) {
        airCombat = {
          ...airCombat,
          existingRecords: res.airCombatRecords.map((r) => ({ ...r })),
        };
      }
    }
    if (airDefense && res.airDefenseStates) {
      const nextStates = res.airDefenseStates;
      airDefense = {
        ...airDefense,
        defenders: airDefense.defenders.map((d) => {
          const ns = nextStates[d.state.defenderId];
          return ns ? { ...d, state: ns } : d;
        }),
      };
    }
  }
  return {
    results,
    hashes: results.map((r) => r.minuteHash),
    finalState: state,
    ...(input.damage ? { damageStates: results.map((r) => r.damageStates ?? {}) } : {}),
    ...(input.torpedoes ? { torpedoTracks: results.map((r) => r.torpedoTracks ?? []) } : {}),
  };
}
