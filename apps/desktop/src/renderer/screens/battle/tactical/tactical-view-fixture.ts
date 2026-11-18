import type {
  BattleView,
  BattleViewContact,
  BattleViewOwnDivision,
  BattleViewOwnShip,
} from "@bluewave/combat/battleResolution";
import { UM_PER_METRE } from "../../../lib/presentation-format/units.js";
import type { TacticalShip, TacticalView } from "./tactical-view.js";

function metres(position: readonly [number, number]): readonly [number, number] {
  return [position[0] / UM_PER_METRE, position[1] / UM_PER_METRE];
}

function ownShip(ship: TacticalShip): BattleViewOwnShip {
  return {
    shipId: ship.shipId,
    name: ship.name,
    className: "Class",
    shipType: ship.shipType ?? "ironclad",
    divisionId: ship.divisionId,
    positionM: ship.position === null ? null : metres(ship.position),
    headingDeg: ship.headingDeg,
    orderedSpeedMilliKnots: ship.speedMilliKnots,
    currentSpeedMilliKnots: ship.speedMilliKnots,
    attainableSpeedMilliKnots: ship.speedMilliKnots,
    speedExplanation: ship.motion ?? null,
    damageStars: 0,
    damageState: ship.damageState,
    hitPoints: ship.hitPoints ?? 0,
    maxHitPoints: ship.maxHitPoints ?? 0,
    explanations: {
      gunneryAccuracy: ship.gunneryAccuracy ?? null,
      torpedoSolution: ship.torpedoSolution ?? null,
      damageControl: ship.damageControl ?? null,
      loss: ship.loss ?? null,
    },
    carriesMines: null,
    machinery: null,
    turrets: [],
  };
}

function contact(ship: TacticalShip): BattleViewContact | null {
  if (ship.position === null) return null;
  return {
    handle: ship.shipId,
    tier: "UNIDENTIFIED",
    positionM: metres(ship.position),
    ageMinutes: 0,
    courseDeg: ship.headingDeg ?? 0,
    speedMilliKnots: ship.speedMilliKnots ?? 0,
    confidenceBp: ship.contactConfidenceBp ?? 10_000,
    stale: false,
  };
}

function division(entry: TacticalView["divisions"][number]): BattleViewOwnDivision {
  return {
    divisionId: entry.divisionId,
    flag: "PLAYER",
    role: entry.role,
    formation: entry.formation,
    leadShipId: entry.flagshipId,
    control: "PLAYER",
    shipIds: entry.unitIds,
    order: null,
    offStation: null,
  };
}

export function battleViewFor(view: TacticalView): BattleView {
  return {
    version: "battle_view_v1",
    battleId: view.battleId,
    areaId: view.areaId,
    campaignMonth: view.campaignMonth,
    side: "ATTACKER",
    playerNationId: "uk",
    ended: view.ended,
    endReason: view.endReason,
    winnerId: view.winnerId,
    loserId: view.loserId,
    pauseReason: null,
    objectives: view.objectives,
    status: {
      minute: view.minute,
      elapsedMinutes: view.minute,
      maxMinutes: view.maxMinutes,
      dayPhase: view.weather.daylight ? "DAY" : "NIGHT",
      localMinuteOfDay: null,
      latLonAnchor: null,
      weather: {
        seaState: view.weather.seaState,
        precipitation: view.weather.precipitation,
        daylight: view.weather.daylight,
        visibilityM: view.weather.visibilityM,
        windDirectionDeg: 0,
        windSpeedMetresPerSecond: 0,
      },
    },
    divisions: view.divisions.map(division),
    ships: view.ships.filter((ship) => ship.own).map(ownShip),
    contacts: view.ships
      .filter((ship) => !ship.own)
      .flatMap((ship) => {
        const built = contact(ship);
        return built === null ? [] : [built];
      }),
    friendlyReports: [],
    overlays: {
      sightingRangesM: { visualM: view.weather.visibilityM, radarM: null },
      gunRangeArcs: [],
      fireLines: [],
      smoke: [],
      flotillaAttack: null,
      forceState: null,
      terrain: { land: [], shallows: [], exclusionZones: [] },
    },
    log: view.log.map((event) => ({
      minute: event.minute,
      severity: "INFO",
      eventType: event.eventType,
      actorRef: event.actorId === "" ? null : event.actorId,
      targetRef: event.targetId === "" ? null : event.targetId,
      actorPositionM: null,
    })),
    accessibility: {
      tierLabels: { UNIDENTIFIED: "Unidentified", TYPE: "Type", CLASS: "Class" },
      stars: {},
    },
  };
}
