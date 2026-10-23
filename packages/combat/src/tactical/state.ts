import type { SafeInt } from "@bluewave/contracts";
import type { TacticalShipUnit } from "./unit.js";
import type { TacticalDivision } from "./division.js";
import type { TacticalContact } from "../contact/lifecycle.js";
import type { MovementState } from "../movement/neighbour.js";

export type TacticalSideId = "ATTACKER" | "DEFENDER";

export interface TacticalSideRecord {
  sideId: TacticalSideId;
  participantIds: string[];
}

export interface WeatherVisibilityPlaceholder {
  weather: string;
  seaState: string;
  visibilityNm: number;
  daylight: boolean;
}

export interface ObjectiveRecord {
  objectiveId: string;
  missionType: string;
  participantId: string;
}

export interface ExitZoneTactical {
  exitZoneId: string;
  sideId: TacticalSideId;
}

export interface BattleContact {
  contactId: string;
  targetId: string;
  confidenceBp: SafeInt;
}

export interface TacticalBattleEvent {
  eventId: string;
  battleId: string;
  eventType: string;
  actorId: string;
  targetId?: string;
}

export interface TacticalBattleState {
  battleId: string;
  mapId: string;
  sides: TacticalSideRecord[];
  forces: Record<string, string[]>;
  divisions: TacticalDivision[];
  units: TacticalShipUnit[];
  contacts: TacticalContact[];
  movementStates?: Record<string, MovementState>;
  objectives: ObjectiveRecord[];
  weather: WeatherVisibilityPlaceholder;
  exitZones: ExitZoneTactical[];
  battleEventLedger: TacticalBattleEvent[];
}
