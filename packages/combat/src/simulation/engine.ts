// DESIGN-38 §3 tactical minute-advance simulation over TacticalBattleState. This
// module owns the public request/result contracts and the ordered minute
// orchestrator; each deterministic stage lives in ./minuteStages.js.
import type { RandomEngine } from "@bluewave/random";
import type { MovementState } from "../movement.js";
import { BattleLedger, type BattleEvent } from "../battleLedger.js";
import type { TacticalContact } from "../contact/lifecycle.js";
import type { GunneryBattery, GunneryState } from "../gunnery/index.js";
import type { GunneryEventRecord } from "../gunnery/event.js";
import type { WeatherEngineContext } from "../weather/engine.js";
import type { BattleWeatherComponents } from "../weather/components.js";
import type { TacticalBattleState } from "../tactical/index.js";
import type { ShipDamageState } from "../damage/state.js";
import type { DamageContext } from "../battleResolution/damage.js";
import type {
  TorpedoContext,
  TorpedoLauncherState,
  TorpedoRecord,
  TorpedoTrack,
} from "../torpedoes/index.js";
import type { SmokeContext } from "../smoke/engineWiring.js";
import type { SmokeCloud } from "../smoke/model.js";
import type { SmokeEventRecord } from "../smoke/smokeRecords.js";
import type { DamageControlContext } from "../damage/damageControlEngineWiring.js";
import type { AirCombatContext } from "../air-combat/engineWiring.js";
import type { AirCombatRecord } from "../air-combat/records.js";
import type { AirDefenseContext } from "../air-defense/engineWiring.js";
import type { AirDefenseEngagementRecord } from "../air-defense/records.js";
import type { AirDefenseState } from "../air-defense/air-defense-state.js";
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
  // Optional surface-gunnery batteries (DESIGN-39 / B-3 INC-4) to resolve after
  // spotting (step 8). When absent or empty, gunnery resolution is a strict no-op:
  // zero events appended, minute snapshot/minuteHash byte-identical to the baseline.
  gunnery?: GunneryBattery[];
  // Optional weather-engine context (B-5 / INC-5). When absent, weather resolution
  // is a strict no-op: zero events appended, hashes unchanged.
  weather?: WeatherEngineContext;
  // Optional damage context (B-4/B-6 INC-2). When absent, damage resolution is a
  // strict no-op: zero events appended, minute snapshot/minuteHash byte-identical
  // to the B-2..B-5 baseline. When present, every HIT gunnery salvo is converted
  // into damage impacts and applied via resolveDamage at step 9-10 (substep 3).
  damage?: DamageContext;
  // Optional torpedo stage input (C-1 / INC-7 — DESIGN-40 §12–§22). When
  // absent, the torpedo stage is a strict no-op: zero events appended, minute
  // snapshot/minuteHash byte-identical to the B-2..B-6 baseline. When present,
  // resolveTorpedoes runs AFTER the damage stage and its records/states are
  // threaded (torpedoStates/torpedoTracks) exactly like gunneryStates.
  torpedoes?: TorpedoContext;
  /** Optional smoke context (C-5 / INC-8). When absent, the smoke stage is a
   *  strict no-op: zero events appended, minute snapshot/minuteHash byte-identical
   *  to the pre-INC-8 baseline. When present, resolveSmoke runs after movement
   *  intent (step 5) and before propulsion (step 6). */
  smoke?: SmokeContext;
  /** Optional damage-control contexts (C-5 / INC-8, P-1 ticket 07): a map of
   *  per-ship DamageControlContext keyed by ship assetId. When absent, the
   *  damage-control stage is a strict no-op: zero events appended, minute
   *  snapshot/minuteHash byte-identical to the baseline. When present,
   *  resolveDamageControl runs per ship after damage resolution (steps 9-10 and
   *  10.5) in the same minute; a ship with no active fire/flooding resolution
   *  stays byte-identical too (no state write, no events when nothing changed). */
  damageControl?: Record<string, DamageControlContext>;
  /** Optional air-combat context (D-3 / INC-8). When absent, the resolveAirCombat
   *  stage is a strict no-op: zero records emitted, minute snapshot/minuteHash
   *  byte-identical to the pre-INC-8 baseline. When present, resolveAirCombat runs
   *  after weather (step 7.5) and before spotting (step 8). */
  airCombat?: AirCombatContext;
  /** Optional air-defense context (D-4 / INC-6). When absent, the resolveAirDefense
   *  stage is a strict no-op: zero records emitted, minute snapshot/minuteHash
   *  byte-identical to the pre-INC-6 baseline. When present, resolveAirDefense runs
   *  after air combat (step 7.7) and before spotting (step 8). */
  airDefense?: AirDefenseContext;
}

export interface MinuteResult {
  minute: number;
  movementStates: Record<string, MovementState>;
  contacts: TacticalContact[];
  events: BattleEvent[];
  minuteHash: string;
  // Updated per-battery GunneryState (batteryId -> state) after this minute's
  // gunnery stage. Present only when gunnery batteries were supplied.
  gunneryStates?: Record<string, GunneryState>;
  // The salvo records fired this minute (DESIGN-39 §30). Present only when at
  // least one battery fired; observational (not part of the minute snapshot/hash).
  gunneryRecords?: readonly GunneryEventRecord[];
  // Updated weather components after this minute's weather stage. Present only
  // when weather context was supplied.
  weatherComponents?: BattleWeatherComponents;
  // Updated per-ship ShipDamageState (shipId -> state) after this minute's
  // damage stage. Present only when damage context was supplied.
  damageStates?: Record<string, ShipDamageState>;
  // Updated torpedo launcher states (launcherId -> state) after this minute's
  // torpedo stage. Present only when launchers actually fired.
  torpedoStates?: Record<string, TorpedoLauncherState>;
  // The RUNNING torpedo tracks after this minute's torpedo stage. Present only
  // when the stage resolved a live torpedo entity.
  torpedoTracks?: readonly TorpedoTrack[];
  // The §27 torpedo records emitted this minute. Present only when the stage
  // produced records.
  torpedoRecords?: readonly TorpedoRecord[];
  /** Smoke clouds after this minute's smoke stage. Present only when the stage
   *  resolved clouds. */
  smokeClouds?: SmokeCloud[];
  /** Smoke event records emitted this minute. Present only when the stage
   *  produced records. */
  smokeRecords?: SmokeEventRecord[];
  /** Air-combat records emitted this minute. Present only when the stage
   *  produced records. */
  airCombatRecords?: readonly AirCombatRecord[];
  /** Summary of air-combat activity this minute. Present only when the stage
   *  was active. */
  airCombatSummary?: { capEngagements: number; strikeAttacks: number; losses: number };
  /** Air-defense records emitted this minute (§27 order). Present only when the
   *  stage produced records. */
  airDefenseRecords?: readonly AirDefenseEngagementRecord[];
  /** Per-defender air-defense states after this minute (ammunition consumed).
   *  Present only when the stage produced records. */
  airDefenseStates?: Readonly<Record<string, AirDefenseState>>;
}

export function advanceMinute(input: AdvanceMinuteInput): MinuteResult {
  const { battleId } = input.state;
  const minute = input.minute;
  const ledger = new BattleLedger();
  const units = input.state.units ?? [];

  // Deep copy movement states so sub-step integration never mutates the caller's
  // authoritative state (immutable typed transitions, ENGINEERING-CONTRACT).
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

  updateContactKnowledge(ctx); // step 4
  resolveMovementIntent(ctx); // step 5
  resolveSmokeStage(ctx); // step 5.5
  resolvePropulsionStage(ctx); // step 6
  resolveCollisionsStage(ctx); // step 7
  resolveWeatherStage(ctx); // step 7.5
  resolveAirCombatStage(ctx); // step 7.7
  resolveAirDefenseStage(ctx); // step 7.8
  resolveSensorsStage(ctx); // step 8
  buildShipPositions(ctx); // P-1 ticket 06
  resolveGunneryStage(ctx); // step 8.5
  resolveDamageStage(ctx); // steps 9-10
  resolveTorpedoStage(ctx); // step 10.5
  resolveDamageControlStage(ctx); // step 8.6 (canonically last)
  return buildMinuteResult(ctx);
}

// AC-12: advance a battle state N full minutes in DESIGN-38 order, collecting a
// minute hash per minute.
export interface AdvanceMinutesInput {
  state: TacticalBattleState;
  minutes: number;
  observationTime: string;
  orders?: Record<string, UnitOrders>;
  attackRangeUm?: number;
  engine?: RandomEngine;
  gunnery?: GunneryBattery[];
  /** Optional weather-engine context (B-5 / INC-5). When absent, weather
   *  resolution is a strict no-op across all minutes. */
  weather?: WeatherEngineContext;
  /** Optional damage context (B-4 / B-6 INC-2). When absent, damage resolution
   *  is a strict no-op across all minutes. */
  damage?: DamageContext;
  /** Optional torpedo stage context (C-1 / INC-7). When absent, the torpedo
   *  stage is a strict no-op across all minutes. */
  torpedoes?: TorpedoContext;
  /** Optional smoke context (C-5 / INC-8). When absent, the smoke stage is a
   *  strict no-op across all minutes. When present, smoke clouds are threaded
   *  from minute to minute. */
  smoke?: SmokeContext;
  /** Optional per-ship damage-control contexts (C-5 / INC-8, P-1 ticket 07).
   *  When absent, the damage-control stage is a strict no-op across all
   *  minutes. When present, each ship's fire/flooding records are threaded
   *  from minute to minute via the updated damage states. */
  damageControl?: Record<string, DamageControlContext>;
  /** Optional air-combat context (D-3 / INC-8). When absent, the resolveAirCombat
   *  stage is a strict no-op across all minutes. When present, capPatrols and
   *  strikeMissions are threaded from minute to minute. */
  airCombat?: AirCombatContext;
  /** Optional air-defense context (D-4 / INC-6). When absent, the resolveAirDefense
   *  stage is a strict no-op across all minutes. When present, per-defender states
   *  (ammunition) are threaded from minute to minute. */
  airDefense?: AirDefenseContext;
}
export interface AdvanceMinutesResult {
  results: MinuteResult[];
  hashes: string[];
  finalState: TacticalBattleState;
  /** Per-minute damage states (mirrors results[i].damageStates). */
  damageStates?: Record<string, ShipDamageState>[];
  /** Per-minute torpedo tracks (mirrors results[i].torpedoTracks). */
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
    // Thread the updated battery states into the next minute so ammunition/reload
    // progress persists deterministically across minutes.
    if (res.gunneryStates && gunnery) {
      gunnery = gunnery.map((b) => {
        const ns = res.gunneryStates![b.id];
        return ns ? { ...b, state: ns } : b;
      });
    }
    // Thread the updated weather components into the next minute.
    if (res.weatherComponents && weather) {
      weather = { ...weather, components: res.weatherComponents };
    }
    // Thread the updated damage states into the context targets for the next
    // minute (immutable copy-out pattern).
    if (res.damageStates && damage) {
      damage = { ...damage, targets: { ...damage.targets } };
      for (const [sid, st] of Object.entries(res.damageStates)) {
        if (damage.targets[sid]) damage.targets[sid] = { ...damage.targets[sid]!, state: st };
      }
    }
    // Thread the updated torpedo launcher states + running tracks + target
    // damage states into the next minute (GunneryState idiom).
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
    // Thread the updated smoke clouds into the next minute.
    if (smoke && res.smokeClouds) {
      smoke = { ...smoke, clouds: res.smokeClouds };
    }
    // Thread the updated damage-control contexts into the next minute
    // (P-1 ticket 07). The damage-control stage's write-back lands in
    // res.damageStates, so every context whose ship state changed this minute
    // is rebased on the authoritative new state.
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
    // Thread the updated air-combat context into the next minute (D-3 / INC-8).
    if (airCombat) {
      if (res.airCombatRecords) {
        airCombat = {
          ...airCombat,
          existingRecords: res.airCombatRecords.map((r) => ({ ...r })),
        };
      }
    }
    // Thread the per-defender air-defense states (ammunition) into the next minute.
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
