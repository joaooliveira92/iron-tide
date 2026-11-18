import type {
  BattleView,
  BattleViewContact,
  BattleViewLogEntry,
  BattleViewOwnShip,
} from "@bluewave/combat/battleResolution";
import type { ExplanationTree } from "@bluewave/events";
import { UM_PER_METRE } from "../../../lib/presentation-format/units.js";
import type { WorldPoint } from "./tactical-geometry.js";

export interface TacticalShip {
  readonly shipId: string;
  readonly name: string;
  readonly own: boolean;
  readonly divisionId: string | null;
  readonly hitPoints: number | null;
  readonly maxHitPoints: number | null;
  readonly damageState: string;
  readonly position: WorldPoint | null;
  readonly headingDeg: number | null;
  readonly speedMilliKnots: number | null;
  readonly contactConfidenceBp: number | null;
  readonly motion?: ExplanationTree;
  readonly gunneryAccuracy?: ExplanationTree;
  readonly torpedoSolution?: ExplanationTree;
  readonly damageControl?: ExplanationTree;
  readonly loss?: ExplanationTree;
}

export interface TacticalDivision {
  readonly divisionId: string;
  readonly role: string;
  readonly formation: string;
  readonly flagshipId: string;
  readonly unitIds: readonly string[];
}

export interface TacticalLogEvent {
  readonly minute: number;
  readonly eventType: string;
  readonly actorId: string;
  readonly targetId: string;
}

export interface TacticalWeather {
  readonly seaState: string;
  readonly precipitation: string;
  readonly daylight: boolean;
  readonly visibilityM: number;
}

export interface TacticalView {
  readonly battleId: string;
  readonly campaignMonth: string;
  readonly areaId: string;
  readonly minute: number;
  readonly maxMinutes: number;
  readonly ended: boolean;
  readonly endReason: string | null;
  readonly winnerId: string | null;
  readonly loserId: string | null;
  readonly objectives: readonly string[];
  readonly weather: TacticalWeather;
  readonly ships: readonly TacticalShip[];
  readonly divisions: readonly TacticalDivision[];
  readonly log: readonly TacticalLogEvent[];
}

const HANDLE_CHARS = 4;

function point(positionM: readonly [number, number]): WorldPoint {
  return [positionM[0] * UM_PER_METRE, positionM[1] * UM_PER_METRE];
}

export function contactName(contact: BattleViewContact): string {
  const suffix = contact.handle.slice(0, HANDLE_CHARS);
  if (contact.tier === "CLASS") return `${contact.className} ${suffix}`;
  if (contact.tier === "TYPE") return `${contact.shipType} contact ${suffix}`;
  return `Unidentified contact ${suffix}`;
}

function ownShip(ship: BattleViewOwnShip): TacticalShip {
  const { explanations } = ship;
  return {
    shipId: ship.shipId,
    name: ship.name,
    own: true,
    divisionId: ship.divisionId,
    hitPoints: ship.hitPoints,
    maxHitPoints: ship.maxHitPoints,
    damageState: ship.damageState,
    position: ship.positionM === null ? null : point(ship.positionM),
    headingDeg: ship.headingDeg,
    speedMilliKnots: ship.currentSpeedMilliKnots,
    contactConfidenceBp: null,
    ...(ship.speedExplanation === null ? {} : { motion: ship.speedExplanation }),
    ...(explanations.gunneryAccuracy === null
      ? {}
      : { gunneryAccuracy: explanations.gunneryAccuracy }),
    ...(explanations.torpedoSolution === null
      ? {}
      : { torpedoSolution: explanations.torpedoSolution }),
    ...(explanations.damageControl === null ? {} : { damageControl: explanations.damageControl }),
    ...(explanations.loss === null ? {} : { loss: explanations.loss }),
  };
}

function contactShip(contact: BattleViewContact): TacticalShip {
  return {
    shipId: contact.handle,
    name: contactName(contact),
    own: false,
    divisionId: null,
    hitPoints: null,
    maxHitPoints: null,
    damageState: "NORMAL",
    position: point(contact.positionM),
    headingDeg: contact.courseDeg,
    speedMilliKnots: contact.speedMilliKnots,
    contactConfidenceBp: contact.confidenceBp,
  };
}

function logEvent(entry: BattleViewLogEntry): TacticalLogEvent {
  return {
    minute: entry.minute,
    eventType: entry.eventType,
    actorId: entry.actorRef ?? "",
    targetId: entry.targetRef ?? "",
  };
}

export function projectTacticalView(view: BattleView): TacticalView {
  return {
    battleId: view.battleId,
    campaignMonth: view.campaignMonth,
    areaId: view.areaId,
    minute: view.status.minute,
    maxMinutes: view.status.maxMinutes,
    ended: view.ended,
    endReason: view.endReason,
    winnerId: view.winnerId,
    loserId: view.loserId,
    objectives: view.objectives,
    weather: {
      seaState: view.status.weather.seaState,
      precipitation: view.status.weather.precipitation,
      daylight: view.status.weather.daylight,
      visibilityM: view.status.weather.visibilityM,
    },
    ships: [...view.ships.map(ownShip), ...view.contacts.map(contactShip)],
    divisions: view.divisions.map((division) => ({
      divisionId: division.divisionId,
      role: division.role,
      formation: division.formation,
      flagshipId: division.leadShipId,
      unitIds: division.shipIds,
    })),
    log: view.log.map(logEvent),
  };
}
