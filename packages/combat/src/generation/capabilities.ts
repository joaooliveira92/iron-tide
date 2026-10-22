import type { SmokeSourceType } from "../smoke/index.js";
import type { CapEngagementState } from "../air-combat/constants.js";
import type { StrikeMissionPhase } from "../air-combat/strike-state.js";
import type { AirDefenseSystemDefinition } from "../air-defense/air-defense-system-definition.js";

export interface SmokeSourceDeclaration {
  smokeCloudId: string;
  sourceId: string;
  owner: string;
  sourceType: SmokeSourceType;
  centroidPosition: [number, number];
  densityBp: number;
  verticalExtentM: number;
  driftVector?: [number, number];
  expansionRate?: number;
  densityDecayRate?: number;
  fuelComposition: string;
  active?: boolean;
}

export interface CapPatrolDeclaration {
  kind: "CAP";
  sideId: "ATTACKER" | "DEFENDER";
  squadronId: string;
  stationPosition: [number, number];
  operationalAircraftCount: number;
  rangeDistance: number;
  speedScore: number;
  engagementState?: CapEngagementState;
  interceptTargetId?: string | null;
}

export interface StrikeDeclaration {
  kind: "STRIKE";
  sideId: "ATTACKER" | "DEFENDER";
  missionId: string;
  strikeId: string;
  squadronIds: string[];
  targetId: string;
  launchPosition: [number, number];
  speedMps: number;
  fuelRemainingMinutes: number;
  phase?: StrikeMissionPhase;
}

export type AirGroupDeclaration = CapPatrolDeclaration | StrikeDeclaration;

export interface AirDefenseInstallationDeclaration {
  defenderId: string;
  systems: AirDefenseSystemDefinition[];
  crewQuality?: number;
  directorScalingBp?: number;
  radarDiminishingReturnsBp?: number;
}
