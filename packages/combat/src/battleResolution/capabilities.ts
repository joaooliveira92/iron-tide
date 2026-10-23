import { SafeInt } from "@bluewave/contracts";
import type { RandomEngine } from "@bluewave/random";
import { createSmokeCloud, type SmokeContext } from "../smoke/index.js";
import { createCapPatrolState, type CapPatrolState } from "../air-combat/cap-patrol.js";
import { createStrikeMissionState, type StrikeMissionState } from "../air-combat/strike-state.js";
import type { AirCombatContext } from "../air-combat/engineWiring.js";
import { createAirDefenseAttack, type AirDefenseAttack } from "../air-defense/attack.js";
import {
  computeAirDefenseStateHash,
  createAirDefenseState,
  type AirDefenseState,
  type DirectorState,
  type RadarState,
} from "../air-defense/air-defense-state.js";
import { Layer } from "../air-defense/air-defense-system-definition.js";
import type { AirDefenseContext, AirDefenseDefenderContext } from "../air-defense/engineWiring.js";
import type { BattleWeatherComponents } from "../weather/components.js";
import { KNOTS_TO_UM_S } from "../movement/neighbour.js";
import type { BattleManifest } from "../generation/manifest.js";
import type {
  AirDefenseInstallationDeclaration,
  AirGroupDeclaration,
  SmokeSourceDeclaration,
  StrikeDeclaration,
} from "../generation/capabilities.js";

const NEUTRAL_BP = 10_000;

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function projectSmokeContext(
  manifest: BattleManifest,
  components: BattleWeatherComponents,
): SmokeContext {
  const clouds = (manifest.smokeSources ?? [])
    .map(toSmokeCloud)
    .sort((a, b) => compareIds(a.smokeCloudId, b.smokeCloudId));
  return {
    clouds,
    windSpeedKnots: Math.floor(components.windSpeedUmPerSec / KNOTS_TO_UM_S),
    windDirection: components.windDirectionDeg,
    precipitationIntensityBp: components.precipitationIntensityBp,
  };
}

function toSmokeCloud(s: SmokeSourceDeclaration): ReturnType<typeof createSmokeCloud> {
  return createSmokeCloud({
    smokeCloudId: s.smokeCloudId,
    sourceType: s.sourceType,
    sourceId: s.sourceId,
    owner: s.owner,
    creationMinute: 0,
    creationSubstep: 0,
    centroidPosition: s.centroidPosition,
    densityBp: s.densityBp,
    verticalExtentM: s.verticalExtentM,
    driftVector: s.driftVector ?? [0, 0],
    expansionRate: s.expansionRate ?? 0,
    densityDecayRate: s.densityDecayRate ?? 0,
    fuelComposition: s.fuelComposition,
    active: s.active ?? true,
  });
}

export function projectAirCombatContext(
  manifest: BattleManifest,
  battleId: string,
): AirCombatContext {
  const capPatrols: CapPatrolState[] = [];
  const strikeMissions: StrikeMissionState[] = [];
  for (const group of manifest.airGroups ?? []) {
    if (group.kind === "CAP") capPatrols.push(toCapPatrol(group));
    else strikeMissions.push(toStrikeMission(group));
  }
  capPatrols.sort((a, b) => compareIds(a.squadronId, b.squadronId));
  strikeMissions.sort((a, b) => compareIds(a.missionId, b.missionId));
  return {
    battleId,
    minute: 0,
    ...(capPatrols.length > 0 ? { capPatrols } : {}),
    ...(strikeMissions.length > 0 ? { strikeMissions } : {}),
  };
}

function toCapPatrol(g: Extract<AirGroupDeclaration, { kind: "CAP" }>): CapPatrolState {
  const base = createCapPatrolState(
    g.squadronId,
    ["CAP"],
    SafeInt(g.operationalAircraftCount),
    SafeInt(g.rangeDistance),
    SafeInt(g.speedScore),
    g.stationPosition,
  );
  return {
    ...base,
    ...(g.engagementState !== undefined ? { engagementState: g.engagementState } : {}),
    ...(g.interceptTargetId !== undefined ? { interceptTargetId: g.interceptTargetId } : {}),
  };
}

function toStrikeMission(g: StrikeDeclaration): StrikeMissionState {
  const base = createStrikeMissionState(
    g.missionId,
    g.strikeId,
    [...g.squadronIds],
    g.targetId,
    g.launchPosition,
    SafeInt(g.speedMps),
    SafeInt(g.fuelRemainingMinutes),
  );
  return { ...base, ...(g.phase !== undefined ? { phase: g.phase } : {}) };
}

export function projectAirDefenseContext(
  manifest: BattleManifest,
  engine: RandomEngine,
): AirDefenseContext {
  const defenders: AirDefenseDefenderContext[] = (manifest.airDefenseInstallations ?? [])
    .map(toDefenderContext)
    .sort((a, b) => compareIds(a.state.defenderId, b.state.defenderId));
  const attacks: AirDefenseAttack[] = (manifest.airGroups ?? [])
    .filter((g): g is StrikeDeclaration => g.kind === "STRIKE" && g.phase === "ATTACKING")
    .map(toAirDefenseAttack)
    .sort((a, b) => compareIds(a.attackId, b.attackId));
  return { defenders, attacks, engine };
}

function toDefenderContext(d: AirDefenseInstallationDeclaration): AirDefenseDefenderContext {
  const directorState: DirectorState = {
    channelId: `${d.defenderId}:director`,
    assignedLayer: Layer.HEAVY_AA,
    directorIndex: SafeInt(0),
    scalingBp: SafeInt(d.directorScalingBp ?? NEUTRAL_BP),
  };
  const radarState: RadarState = {
    channelId: `${d.defenderId}:radar`,
    assignedLayer: Layer.HEAVY_AA,
    saturationGroup: SafeInt(0),
    diminishingReturnsBp: SafeInt(d.radarDiminishingReturnsBp ?? NEUTRAL_BP),
  };
  const initial = createAirDefenseState(
    d.defenderId,
    "SHIP",
    d.systems,
    directorState,
    radarState,
    SafeInt(d.crewQuality ?? NEUTRAL_BP),
  );
  const state: AirDefenseState = { ...initial, powerBp: SafeInt(NEUTRAL_BP) };
  state.stateHash = computeAirDefenseStateHash(state);
  return {
    state,
    operability: {
      defenderSunk: false,
      defenderAbandoned: false,
      systemPowered: true,
      systemOperational: true,
    },
    directorAvailable: true,
    radarAvailable: true,
  };
}

function toAirDefenseAttack(g: StrikeDeclaration): AirDefenseAttack {
  const formationSize = Math.max(1, g.squadronIds.length);
  return createAirDefenseAttack({
    attackId: `${g.strikeId}:attack`,
    formationId: g.strikeId,
    targetId: g.targetId,
    speedKnots: SafeInt(Math.floor((g.speedMps * 1_000) / KNOTS_TO_UM_S)),
    speedMps: SafeInt(g.speedMps),
    formationSize: SafeInt(formationSize),
  });
}
