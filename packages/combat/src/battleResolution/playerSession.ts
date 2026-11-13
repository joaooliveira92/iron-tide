import { BluewaveError } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import { withGunneryStateHash } from "../gunnery/index.js";
import { ageContact, isStale } from "../contact/neighbour.js";
import type { TacticalBattleState } from "../tactical/state.js";
import type { TorpedoContext } from "../torpedoes/index.js";
import { advanceMinute } from "../simulation/engine.js";
import { BATTLE_SEED_FORMULA_VERSION, deriveBattleSeed } from "../generation/seed.js";
import { AUTO_RESOLUTION_MAX_MINUTES } from "./constants.js";
import { projectBattle, type ProjectBattleOutput } from "./project.js";
import { buildBattleWeather } from "../weather/neighbour.js";
import type {
  CreatePlayerBattleInput,
  PlayerBattleOrders,
  PlayerBattleSession,
} from "./playerSessionTypes.js";
import {
  projectAirCombatContext,
  projectAirDefenseContext,
  projectSmokeContext,
} from "./capabilities.js";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";
import { planTorpedoCommands } from "./torpedoDoctrine.js";
import { withNightTraining } from "./trainingEffects.js";
import { resolveOrders } from "./playerSessionOrders.js";
import { resultOf } from "./playerSessionSnapshot.js";
import {
  assignTargetContactIds,
  buildDamageControlContexts,
  mergeTargetStates,
} from "./resolve.js";
import { initialDamageState, type DamageContext } from "../damage/minuteDamage.js";
import { decideBattleEnd, type BattleSide, type ShipViability } from "./viability.js";

export { PLAYER_BATTLE_STANCES } from "./playerSessionTypes.js";
export type {
  CreatePlayerBattleInput,
  PlayerBattleDivisionOrder,
  PlayerBattleDivisionView,
  PlayerBattleEvent,
  PlayerBattleOrders,
  PlayerBattleResult,
  PlayerBattleSession,
  PlayerBattleShipView,
  PlayerBattleStance,
  PlayerBattleView,
} from "./playerSessionTypes.js";

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
    ...(input.gunQuality === undefined ? {} : { gunQuality: input.gunQuality }),
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

function withSurvivingContacts(state: TacticalBattleState): TacticalBattleState {
  return {
    ...state,
    contacts: (state.contacts ?? [])
      .map((contact) => ageContact(contact, 1))
      .filter((contact) => !isStale(contact)),
  };
}

function planTorpedoes(session: PlayerBattleSession, torpedoes: TorpedoContext): TorpedoContext {
  return {
    ...torpedoes,
    commands: planTorpedoCommands({
      battleId: session.battleId,
      torpedoes,
      battleState: withSurvivingContacts(session.state),
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
    withSurvivingContacts(session.state),
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

export {
  playerBattleResult,
  playerBattleSessionHash,
  playerBattleView,
} from "./playerSessionSnapshot.js";
