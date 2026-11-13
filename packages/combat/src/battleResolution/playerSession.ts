import { BluewaveError } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import { BATTLE_SEED_FORMULA_VERSION, deriveBattleSeed } from "../generation/seed.js";
import { buildBattleWeather } from "../weather/neighbour.js";
import { AUTO_RESOLUTION_MAX_MINUTES } from "./constants.js";
import { projectBattle, type ProjectBattleOutput } from "./project.js";
import type { CreatePlayerBattleInput, PlayerBattleSession } from "./playerSessionTypes.js";
import {
  projectAirCombatContext,
  projectAirDefenseContext,
  projectSmokeContext,
} from "./capabilities.js";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";

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
export { advancePlayerBattleMinute, runPlayerBattleToEnd } from "./playerSessionAdvance.js";
export {
  playerBattleResult,
  playerBattleSessionHash,
  playerBattleView,
} from "./playerSessionSnapshot.js";

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
