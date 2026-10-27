import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine } from "@bluewave/random";
import type { ExplanationTree } from "@bluewave/events";
import type { GunneryBattery } from "../gunnery/resolve.js";
import { withGunneryStateHash } from "../gunnery/index.js";
import type { TacticalBattleState } from "../tactical/state.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import type { TacticalDivision } from "../tactical/division.js";
import type { MovementState } from "../movement/neighbour.js";
import type { StrategicWeatherState, WeatherEngineContext } from "../weather/neighbour.js";
import type { TorpedoContext } from "../torpedoes/index.js";
import type { MissileContext, MissileRules } from "../missiles/index.js";
import type { SmokeContext } from "../smoke/engineWiring.js";
import type { AirCombatContext } from "../air-combat/engineWiring.js";
import type { AirDefenseContext } from "../air-defense/engineWiring.js";
import { advanceMinute, type UnitOrders } from "../simulation/engine.js";
import { BATTLE_SEED_FORMULA_VERSION, deriveBattleSeed } from "../generation/seed.js";
import type { BattleManifest } from "../generation/manifest.js";
import { AUTO_RESOLUTION_MAX_MINUTES } from "./constants.js";
import type { GunneryRadarRules } from "./gunneryRadar.js";
import { type AutoResolverNation, projectBattle, type ProjectBattleOutput } from "./project.js";
import { buildBattleWeather } from "../weather/neighbour.js";
import {
  projectAirCombatContext,
  projectAirDefenseContext,
  projectSmokeContext,
} from "./capabilities.js";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";
import { planTorpedoCommands } from "./torpedoDoctrine.js";
import { explainGunneryAccuracy } from "../gunnery/accuracy-explanation.js";
import { withNightTraining, effectsOf, type TrainingEffectsBySide } from "./trainingEffects.js";
import {
  explainBattleLoss,
  explainDamageControl,
  explainTorpedoSolution,
} from "./battle-explanations.js";
import { pursuitOrders } from "./pursuit.js";
import {
  assignTargetContactIds,
  buildDamageControlContexts,
  mergeTargetStates,
} from "./resolve.js";
import { battleLoss, initialDamageState, type DamageContext } from "../damage/minuteDamage.js";
import { decideBattleEnd, type BattleSide, type ShipViability } from "./viability.js";
import { headingToward } from "./engagement.js";

export const PLAYER_BATTLE_STANCES = ["ENGAGE", "HOLD", "WITHDRAW"] as const;
export type PlayerBattleStance = (typeof PLAYER_BATTLE_STANCES)[number];

export interface PlayerBattleDivisionOrder {
  readonly stance: PlayerBattleStance;
  readonly speedPercent: number;
}

export interface PlayerBattleOrders {
  readonly divisions: Readonly<Record<string, PlayerBattleDivisionOrder>>;
}

export interface PlayerBattleEvent {
  readonly minute: number;
  readonly eventType: string;
  readonly actorId: string;
  readonly targetId: string;
}

export interface PlayerBattleShipView {
  readonly shipId: string;
  readonly name: string;
  readonly className: string;
  readonly shipType: string;
  readonly sideId: string;
  readonly divisionId: string | null;
  readonly hitPoints: number;
  readonly maxHitPoints: number;
  readonly damageState: string;
  readonly position: readonly [number, number] | null;
  readonly gunneryAccuracy?: ExplanationTree;
  readonly torpedoSolution?: ExplanationTree;
  readonly damageControl?: ExplanationTree;
  readonly loss?: ExplanationTree;
}

export interface PlayerBattleDivisionView {
  readonly divisionId: string;
  readonly sideId: string;
  readonly role: string;
  readonly formation: string;
  readonly flagshipId: string;
  readonly unitIds: readonly string[];
}

export interface PlayerBattleView {
  readonly battleId: string;
  readonly campaignMonth: string;
  readonly playerNationId: string;
  readonly areaId: string;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly minute: number;
  readonly maxMinutes: number;
  readonly ended: boolean;
  readonly endReason: string | null;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly objectives: readonly string[];
  readonly weather: {
    readonly seaState: string;
    readonly visibilityNm: number;
    readonly precipitation: string;
    readonly daylight: boolean;
  };
  readonly ships: readonly PlayerBattleShipView[];
  readonly divisions: readonly PlayerBattleDivisionView[];
  readonly log: readonly PlayerBattleEvent[];
}

export interface PlayerBattleResult {
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly attackerLosses: readonly string[];
  readonly defenderLosses: readonly string[];
  readonly damageReport: Readonly<Record<string, number>>;
}

export interface CreatePlayerBattleInput {
  readonly manifest: BattleManifest;
  readonly areaId: string;
  readonly campaignMonth: string;
  readonly attacker: AutoResolverNation;
  readonly defender: AutoResolverNation;
  readonly playerNationId: string;
  readonly strategicWeather: StrategicWeatherState;
  readonly campaignSeed: string;
  readonly rulesetVersion: string;
  readonly formulaVersion: string;
  readonly rngVersion: string;
  readonly gunneryRadar?: GunneryRadarRules;
  readonly missilesRules?: MissileRules;
  readonly maxMinutes?: number;
}

export interface PlayerBattleSession {
  readonly battleId: string;
  readonly areaId: string;
  readonly campaignMonth: string;
  readonly playerNationId: string;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly seed: string;
  readonly battleDate: string;
  readonly maxMinutes: number;
  readonly minute: number;
  readonly ended: boolean;
  readonly endReason: string | null;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly objectives: readonly string[];
  readonly state: TacticalBattleState;
  readonly batteries: readonly GunneryBattery[];
  readonly damage: DamageContext;
  readonly weather: WeatherEngineContext;
  readonly torpedoes?: TorpedoContext;
  readonly missiles?: MissileContext;
  readonly smoke: SmokeContext;
  readonly airCombat: AirCombatContext;
  readonly airDefense: AirDefenseContext;
  readonly units: readonly TacticalShipUnit[];
  readonly trainingEffects: TrainingEffectsBySide;
  readonly baseOrders: Readonly<
    Record<string, { readonly orderedHeading: number; readonly orderedSpeedBp: number }>
  >;
  readonly log: readonly PlayerBattleEvent[];
  readonly result: PlayerBattleResult | null;
}

interface ProjectedBattle {
  readonly projection: ProjectBattleOutput;
  readonly weather: ReturnType<typeof buildBattleWeather>;
}

function project(input: CreatePlayerBattleInput): ProjectedBattle {
  const projection = projectBattle({
    manifest: input.manifest,
    areaId: input.areaId,
    campaignMonth: input.campaignMonth,
    attacker: input.attacker,
    defender: input.defender,
    rulesetVersion: input.rulesetVersion,
    ...(input.gunneryRadar === undefined ? {} : { gunneryRadar: input.gunneryRadar }),
    ...(input.missilesRules === undefined ? {} : { missilesRules: input.missilesRules }),
  });
  const battleSeed = deriveBattleSeed(
    {
      rngVersion: input.rngVersion,
      campaignSeed: input.campaignSeed,
      campaignMonth: input.campaignMonth,
      warId: input.manifest.warId,
      areaId: input.areaId,
      missionType: input.manifest.missionType,
      opportunityId: input.manifest.opportunityId,
      battleGenerationFormulaVersion: BATTLE_SEED_FORMULA_VERSION,
    },
    input.manifest,
  );
  const weather = buildBattleWeather({
    battleId: input.manifest.battleId,
    areaId: input.areaId,
    campaignMonth: input.campaignMonth,
    strategicWeather: input.strategicWeather,
    battleSeed,
  });
  return { projection, weather };
}

export function createPlayerBattleSession(input: CreatePlayerBattleInput): PlayerBattleSession {
  const { projection, weather } = project(input);
  const attackerUnits = projection.units.filter((u) => u.sideId === "ATTACKER");
  const defenderUnits = projection.units.filter((u) => u.sideId === "DEFENDER");
  if (attackerUnits.length === 0 || defenderUnits.length === 0) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      reason: "both sides require at least one committed, promotable ship",
    });
  }
  const battleSeed = deriveBattleSeed(
    {
      rngVersion: input.rngVersion,
      campaignSeed: input.campaignSeed,
      campaignMonth: input.campaignMonth,
      warId: input.manifest.warId,
      areaId: input.areaId,
      missionType: input.manifest.missionType,
      opportunityId: input.manifest.opportunityId,
      battleGenerationFormulaVersion: BATTLE_SEED_FORMULA_VERSION,
    },
    input.manifest,
  );
  const engine = new RandomEngine(battleSeed);

  return {
    battleId: input.manifest.battleId,
    areaId: input.areaId,
    campaignMonth: input.campaignMonth,
    playerNationId: input.playerNationId,
    attackerId: input.manifest.attackerId,
    defenderId: input.manifest.defenderId,
    seed: battleSeed,
    battleDate: weather.battleDate,
    maxMinutes: input.maxMinutes ?? AUTO_RESOLUTION_MAX_MINUTES,
    minute: 0,
    ended: false,
    endReason: null,
    winnerId: null,
    loserId: null,
    objectives: [...input.manifest.missionObjectives],
    state: {
      ...projection.state,
      contacts: [...(projection.state.contacts ?? [])],
      movementStates: { ...projection.state.movementStates },
    },
    batteries: [...projection.batteries],
    damage: { ...projection.damage, engine },
    weather: weather.context,
    ...(projection.torpedoes ? { torpedoes: projection.torpedoes } : {}),
    ...(projection.missiles ? { missiles: projection.missiles } : {}),
    smoke: projectSmokeContext(input.manifest, weather.context.components),
    airCombat: projectAirCombatContext(input.manifest, projection.state.battleId),
    airDefense: projectAirDefenseContext(input.manifest, engine),
    units: projection.units,
    trainingEffects: projection.trainingEffects,
    baseOrders: projection.orders,
    log: [],
    result: null,
  };
}

function clampSpeedPercent(value: number): number {
  if (!Number.isInteger(value)) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      reason: "speedPercent must be an integer",
      value,
    });
  }
  return Math.min(100, Math.max(0, value));
}

function divisionOf(state: TacticalBattleState): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const division of state.divisions) {
    for (const unitId of division.orderedTacticalUnitIds) {
      map.set(unitId, division.tacticalDivisionId);
    }
  }
  return map;
}

function headingAway(session: PlayerBattleSession, unit: TacticalShipUnit): number | null {
  const movement = session.state.movementStates?.[unit.assetId];
  if (!movement) return null;
  const contacts = new Map(
    (session.state.contacts ?? []).map((contact) => [contact.contactId, contact.position] as const),
  );
  const live = (shipId: string): boolean =>
    (session.damage.targets[shipId]?.state.terminalStatus ?? "NORMAL") === "NORMAL";
  let nearest: readonly [number, number] | null = null;
  let bestD2 = Number.POSITIVE_INFINITY;
  for (const enemy of session.units) {
    if (enemy.sideId === unit.sideId || !live(enemy.assetId)) continue;
    const position = contacts.get(`${session.battleId}:${enemy.assetId}`);
    if (!position) continue;
    const dx = position[0] - movement.position[0];
    const dy = position[1] - movement.position[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      nearest = position;
    }
  }
  if (!nearest) return null;
  return (
    (headingToward(nearest[0] - movement.position[0], nearest[1] - movement.position[1]) + 180) %
    360
  );
}

function resolveOrders(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
): Record<string, UnitOrders> {
  const pursuit = pursuitOrders({
    battleId: session.battleId,
    battleState: session.state,
    damage: session.damage,
    units: session.units,
    baseOrders: session.baseOrders,
  });
  const unitDivision = divisionOf(session.state);
  const out: Record<string, UnitOrders> = {};
  for (const unit of session.units) {
    const base = session.baseOrders[unit.assetId];
    if (!base) continue;
    const divisionId = unitDivision.get(unit.assetId);
    const order = divisionId === undefined ? undefined : orders.divisions[divisionId];
    if (order === undefined || order.stance === "ENGAGE") {
      const speedPercent = order === undefined ? 100 : clampSpeedPercent(order.speedPercent);
      const pursuitOrder = pursuit[unit.assetId];
      out[unit.assetId] = {
        orderedHeading: pursuitOrder?.orderedHeading ?? base.orderedHeading,
        orderedSpeedBp: Math.floor((base.orderedSpeedBp * speedPercent) / 100),
      };
      continue;
    }
    if (order.stance === "HOLD") {
      out[unit.assetId] = { orderedHeading: base.orderedHeading, orderedSpeedBp: 0 };
      continue;
    }
    const away = headingAway(session, unit);
    const speedPercent = clampSpeedPercent(order.speedPercent);
    out[unit.assetId] = {
      orderedHeading: away ?? base.orderedHeading,
      orderedSpeedBp: Math.floor((base.orderedSpeedBp * speedPercent) / 100),
    };
  }
  return out;
}

function damageControlFor(
  session: PlayerBattleSession,
  minute: number,
): Record<string, ReturnType<typeof buildDamageControlContexts>[string]> | undefined {
  const engine = session.damage.engine;
  if (engine === undefined) return undefined;
  return buildDamageControlContexts({
    battleId: session.battleId,
    minute,
    units: session.units,
    damage: session.damage,
    movementStates: session.state.movementStates,
    engine,
    trainingEffects: session.trainingEffects,
  });
}

function mercureTargets(session: PlayerBattleSession): TorpedoContext | undefined {
  const torpedoes = session.torpedoes;
  if (torpedoes === undefined) return undefined;
  const targets = { ...torpedoes.targets };
  for (const [shipId, target] of Object.entries(targets)) {
    const state = session.damage.targets[shipId]?.state;
    if (state) targets[shipId] = { ...target, damageState: state };
  }
  return { ...torpedoes, targets };
}

function planTorpedoes(session: PlayerBattleSession, torpedoes: TorpedoContext): TorpedoContext {
  return {
    ...torpedoes,
    commands: planTorpedoCommands({
      battleId: session.battleId,
      torpedoes,
      battleState: session.state,
      damage: session.damage,
      units: session.units,
      trainingEffects: session.trainingEffects,
    }),
  };
}

function combatantsDamage(session: PlayerBattleSession): readonly ShipViability[] {
  return session.units.map((unit) => ({
    assetId: unit.assetId,
    sideId: unit.sideId as BattleSide,
    damageState: session.damage.targets[unit.assetId]?.state ?? initialDamageState(unit.assetId),
  }));
}

function resultOf(session: PlayerBattleSession): PlayerBattleResult {
  const sunk = (side: BattleSide): string[] =>
    session.units
      .filter((unit) => unit.sideId === side)
      .filter(
        (unit) =>
          (session.damage.targets[unit.assetId]?.state.terminalStatus ?? "NORMAL") !== "NORMAL",
      )
      .map((unit) => unit.assetId)
      .sort();
  const damageReport: Record<string, number> = {};
  for (const unit of session.units) {
    const state = session.damage.targets[unit.assetId]?.state;
    if (!state) continue;
    damageReport[unit.assetId] = battleLoss(
      unit.hitPoints as number,
      state,
      unit.maxHitPoints as number,
    );
  }
  return {
    winnerId: session.winnerId,
    loserId: session.loserId,
    attackerLosses: sunk("ATTACKER"),
    defenderLosses: sunk("DEFENDER"),
    damageReport,
  };
}

export function advancePlayerBattleMinute(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
): PlayerBattleSession {
  if (session.ended) return session;
  const minute = session.minute + 1;
  const observationTime = `${session.battleDate}T06:00:00.000Z`;
  const engine = session.damage.engine;

  const torpedoes = mercureTargets(session);
  const preparedTorpedoes = torpedoes === undefined ? undefined : planTorpedoes(session, torpedoes);
  const targets = assignTargetContactIds(
    session.batteries,
    session.state,
    session.damage,
    session.battleId,
    session.units,
  );
  const batteries = session.batteries.map((battery) => {
    const target = targets[battery.id];
    return target === undefined
      ? battery
      : { ...battery, state: withGunneryStateHash({ ...battery.state, targetContactId: target }) };
  });
  const damageControl = damageControlFor(session, minute);

  const result = advanceMinute({
    state: session.state,
    minute,
    observationTime,
    orders: resolveOrders(session, orders),
    ...(engine === undefined ? {} : { engine }),
    gunnery: withNightTraining(
      batteries,
      session.trainingEffects,
      session.weather.components.timeOfDay,
    ),
    weather: session.weather,
    damage: session.damage,
    ...(preparedTorpedoes === undefined ? {} : { torpedoes: preparedTorpedoes }),
    ...(session.missiles === undefined ? {} : { missiles: session.missiles }),
    ...(damageControl === undefined ? {} : { damageControl }),
    smoke: session.smoke,
    airCombat: session.airCombat,
    airDefense: session.airDefense,
  });

  let damage: DamageContext = session.damage;
  if (result.damageStates) {
    damage = { ...damage, targets: mergeTargetStates(damage.targets, result.damageStates) };
  }
  let weather = session.weather;
  if (result.weatherComponents) weather = { ...weather, components: result.weatherComponents };
  let smoke = session.smoke;
  if (result.smokeClouds) smoke = { ...smoke, clouds: result.smokeClouds };
  let airCombat = session.airCombat;
  if (result.airCombatRecords) {
    airCombat = { ...airCombat, existingRecords: result.airCombatRecords.map((r) => ({ ...r })) };
  }
  let airDefense = session.airDefense;
  if (result.airDefenseStates) {
    const states = result.airDefenseStates;
    airDefense = {
      ...airDefense,
      defenders: airDefense.defenders.map((defender) => {
        const next = states[defender.state.defenderId];
        return next ? { ...defender, state: next } : defender;
      }),
    };
  }
  let nextTorpedoes: TorpedoContext | undefined;
  if (preparedTorpedoes !== undefined) {
    nextTorpedoes = {
      ...preparedTorpedoes,
      commands: [],
      tracks: (result.torpedoTracks ?? []).map((track) => ({ ...track })),
      launchers: result.torpedoStates
        ? preparedTorpedoes.launchers.map((wiring) => {
            const next = result.torpedoStates![wiring.launcher.launcherId];
            return next ? { ...wiring, launcher: next } : wiring;
          })
        : preparedTorpedoes.launchers,
    };
  }
  let nextMissiles = session.missiles;
  if (nextMissiles !== undefined && (result.missileStates || result.missileSalvos)) {
    nextMissiles = {
      ...nextMissiles,
      launchers: result.missileStates
        ? nextMissiles.launchers.map((launcher) => {
            const next = result.missileStates![launcher.launcherId];
            return next ? { ...launcher, ...next } : launcher;
          })
        : nextMissiles.launchers,
      inFlight: result.missileSalvos ? [...result.missileSalvos] : nextMissiles.inFlight,
    };
  }
  const gunneryStates = result.gunneryStates;
  const nextBatteries =
    gunneryStates === undefined
      ? batteries
      : batteries.map((battery) => {
          const next = gunneryStates[battery.id];
          return next === undefined ? battery : { ...battery, state: next };
        });
  const state: TacticalBattleState = {
    ...session.state,
    contacts: result.contacts.map((contact) => ({ ...contact })),
    movementStates: Object.fromEntries(
      Object.entries(result.movementStates).map(([key, value]) => [key, { ...value }]),
    ),
  };

  const next: PlayerBattleSession = {
    ...session,
    minute,
    state,
    batteries: nextBatteries,
    damage,
    weather,
    smoke,
    airCombat,
    airDefense,
    ...(nextTorpedoes === undefined ? {} : { torpedoes: nextTorpedoes }),
    ...(nextMissiles === undefined ? {} : { missiles: nextMissiles }),
    log: [
      ...session.log,
      ...result.events.map((event) => ({
        minute: event.minute,
        eventType: event.eventType,
        actorId: event.actorId,
        targetId: event.targetId,
      })),
    ],
  };

  const decision = decideBattleEnd(combatantsDamage(next), minute, next.maxMinutes);
  if (!decision.ended) return next;

  let winnerId: string | null = null;
  let loserId: string | null = null;
  if (decision.reason === "no_viable_combatants") {
    if (decision.eliminatedSide === "ATTACKER") {
      winnerId = session.defenderId;
      loserId = session.attackerId;
    } else if (decision.eliminatedSide === "DEFENDER") {
      winnerId = session.attackerId;
      loserId = session.defenderId;
    }
  } else if (decision.reason === "withdrawal_complete") {
    if (decision.withdrawnSide === "ATTACKER") {
      winnerId = session.defenderId;
      loserId = session.attackerId;
    } else if (decision.withdrawnSide === "DEFENDER") {
      winnerId = session.attackerId;
      loserId = session.defenderId;
    }
  }

  const ended: PlayerBattleSession = {
    ...next,
    ended: true,
    endReason: decision.reason ?? null,
    winnerId,
    loserId,
  };
  return { ...ended, result: resultOf(ended) };
}

export function runPlayerBattleToEnd(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
): PlayerBattleSession {
  let current = session;
  while (!current.ended && current.minute < current.maxMinutes) {
    current = advancePlayerBattleMinute(current, orders);
  }
  return current;
}

export function playerBattleResult(session: PlayerBattleSession): PlayerBattleResult {
  if (session.result !== null) return session.result;
  return resultOf(session);
}

export function playerBattleSessionHash(session: PlayerBattleSession): string {
  return sha256Hex(
    canonicalSerialize({
      battleId: session.battleId,
      minute: session.minute,
      ended: session.ended,
      endReason: session.endReason,
      winnerId: session.winnerId,
      loserId: session.loserId,
      state: session.state,
      batteries: session.batteries,
      damageTargets: session.damage.targets,
      weather: session.weather.components,
      torpedoes: session.torpedoes ?? null,
      missiles: session.missiles ?? null,
      smoke: session.smoke,
      airCombat: session.airCombat,
      airDefense: session.airDefense,
      log: session.log,
    }),
  );
}

export function playerBattleView(session: PlayerBattleSession): PlayerBattleView {
  const divisionOfUnit = divisionOf(session.state);
  const divisions: PlayerBattleDivisionView[] = session.state.divisions.map(
    (division: TacticalDivision) => ({
      divisionId: division.tacticalDivisionId,
      sideId: division.sideId,
      role: division.role,
      formation: division.formation,
      flagshipId: division.tacticalFlagshipId,
      unitIds: [...division.orderedTacticalUnitIds],
    }),
  );
  const playerSide = session.attackerId === session.playerNationId ? "ATTACKER" : "DEFENDER";
  const playerTorpedoShips = new Set(
    (session.torpedoes?.launchers ?? [])
      .filter((launcher) => launcher.sideId === playerSide)
      .map((launcher) => launcher.ownerShipId),
  );
  const torpedoTacticsBp = effectsOf(session.trainingEffects, playerSide).torpedoTacticsBp;
  const batteryOf = new Map(
    withNightTraining(
      session.batteries,
      session.trainingEffects,
      session.weather.components.timeOfDay,
    )
      .filter((battery) => battery.sideId === playerSide)
      .map((battery) => [battery.ownerShipId, battery] as const),
  );
  const ships: PlayerBattleShipView[] = session.units.map((unit) => {
    const battery = batteryOf.get(unit.assetId);
    const damageState = session.damage.targets[unit.assetId]?.state;
    const movement: MovementState | undefined = session.state.movementStates?.[unit.assetId];
    const own = unit.sideId === playerSide;
    const loss =
      own && damageState !== undefined
        ? explainBattleLoss(unit.hitPoints as number, damageState, unit.maxHitPoints as number)
        : undefined;
    const lossValue = loss === undefined ? 0 : Number(loss.result);
    return {
      shipId: unit.assetId,
      name: unit.name,
      className: unit.className,
      shipType: unit.shipType,
      sideId: unit.sideId,
      divisionId: divisionOfUnit.get(unit.assetId) ?? null,
      hitPoints: unit.hitPoints as number,
      maxHitPoints: unit.maxHitPoints as number,
      damageState: damageState?.terminalStatus ?? "NORMAL",
      position: movement ? [movement.position[0], movement.position[1]] : null,
      ...(battery === undefined
        ? {}
        : { gunneryAccuracy: explainGunneryAccuracy(battery.accuracyFactors) }),
      ...(own && playerTorpedoShips.has(unit.assetId)
        ? { torpedoSolution: explainTorpedoSolution(torpedoTacticsBp) }
        : {}),
      ...(own && lossValue > 0 ? { damageControl: explainDamageControl() } : {}),
      ...(loss === undefined || lossValue === 0 ? {} : { loss }),
    };
  });
  return {
    battleId: session.battleId,
    campaignMonth: session.campaignMonth,
    playerNationId: session.playerNationId,
    areaId: session.areaId,
    attackerId: session.attackerId,
    defenderId: session.defenderId,
    minute: session.minute,
    maxMinutes: session.maxMinutes,
    ended: session.ended,
    endReason: session.endReason,
    winnerId: session.winnerId,
    loserId: session.loserId,
    objectives: session.objectives,
    weather: {
      seaState: session.state.weather.seaState,
      visibilityNm: session.state.weather.visibilityNm,
      precipitation: session.state.weather.weather,
      daylight: session.state.weather.daylight,
    },
    ships,
    divisions,
    log: session.log,
  };
}
