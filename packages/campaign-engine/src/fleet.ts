import type { CampaignSnapshot, PresenceMeasurementRules } from "@bluewave/campaign";
import {
  buildPresenceReadout,
  type PlayerProjectionMonth,
  type PlayerProjectionPresence,
} from "./projection.js";

export type MovementCommandStatus =
  | "submitted"
  | "accepted"
  | "rejected"
  | "superseded"
  | "cancelled";

export interface MovementCommand {
  readonly commandId: string;
  readonly divisionId: string;
  readonly fromAreaId: string;
  readonly toAreaId: string;
  readonly status: MovementCommandStatus;
  readonly submittedAtRevision: number;
}

export interface FleetShipView {
  readonly shipId: string;
  readonly name: string;
  readonly designId: string;
  readonly status: string;
  readonly readiness: string;
  readonly crewQuality: number;
  readonly stationAssignment?: "FOREIGN_STATION";
  readonly stationCode?: "FS";
  readonly colonialServiceFitted?: true;
  readonly colonialCode?: "c";
  readonly repairMonthsRemaining?: number;
  readonly crampedCode?: "a";
  readonly rangeCode?: "S";
  readonly overBase?: true;
  readonly overBaseCode?: "*";
}

const READINESS_STATUS_LABEL: Readonly<Record<string, string>> = {
  ACTIVE: "active",
  RESERVE: "reserve",
  MOTHBALLED: "mothballed",
  WORKING_UP: "working_up",
  REPAIR: "repair",
};

export interface FleetDivisionView {
  readonly divisionId: string;
  readonly fleetName: string;
  readonly areaId: string;
  readonly ships: readonly FleetShipView[];
}

export interface FleetArea {
  readonly id: string;
  readonly name: string;
}

export interface FleetAreaEdge {
  readonly fromAreaId: string;
  readonly toAreaId: string;
}

export interface FleetPort {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly capacity: number;
}

export interface FleetOverBaseShip {
  readonly shipId: string;
  readonly name: string;
  readonly areaId: string;
}

export interface FleetPresenceInput {
  readonly month: PlayerProjectionMonth;
  readonly rules: PresenceMeasurementRules;
}

export interface FleetScreenView {
  readonly divisions: readonly FleetDivisionView[];
  readonly areas: readonly FleetArea[];
  readonly areaEdges: readonly FleetAreaEdge[];
  readonly ports: readonly FleetPort[];
  readonly presence: PlayerProjectionPresence;
  readonly overBaseShips: readonly FleetOverBaseShip[];
}

export function buildFleetScreenView(
  snapshot: CampaignSnapshot,
  playerSlotId: string,
  presence?: FleetPresenceInput,
): FleetScreenView {
  const nation = snapshot.nations.get(playerSlotId);
  if (!nation) {
    return {
      divisions: [],
      areas: [],
      areaEdges: [],
      ports: [],
      presence: { configured: false },
      overBaseShips: [],
    };
  }

  const divisions: FleetDivisionView[] = nation.fleets.map((fleet) => ({
    divisionId: fleet.id,
    fleetName: fleet.name,
    areaId: fleet.locationAreaId,
    ships: fleet.ships.map((ship) => ({
      shipId: ship.id,
      name: ship.name,
      designId: ship.designVersionId,
      status: READINESS_STATUS_LABEL[ship.readiness] ?? "active",
      readiness: ship.readiness,
      crewQuality: Number(ship.crewQuality),
      ...(ship.stationAssignment === undefined
        ? {}
        : { stationAssignment: ship.stationAssignment, stationCode: "FS" as const }),
      ...(ship.readiness === "REPAIR" && ship.repairMonthsRemaining !== undefined
        ? { repairMonthsRemaining: Number(ship.repairMonthsRemaining) }
        : {}),
      ...(snapshot.designs.get(ship.designVersionId)?.crampedAccommodation === true
        ? { crampedCode: "a" as const }
        : {}),
      ...(snapshot.designs.get(ship.designVersionId)?.shortRange === true
        ? { rangeCode: "S" as const }
        : {}),
      ...(ship.colonialServiceFitted === true
        ? { colonialServiceFitted: true as const, colonialCode: "c" as const }
        : {}),
      ...(ship.overBase === undefined
        ? {}
        : { overBase: true as const, overBaseCode: "*" as const }),
    })),
  }));

  const areas: FleetArea[] = snapshot.world.areas
    .map((area) => ({ id: area.id, name: area.name }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const areaEdges: FleetAreaEdge[] = snapshot.world.routes
    .map((route) => ({ fromAreaId: route.from, toAreaId: route.to }))
    .sort((a, b) => {
      const byFrom = a.fromAreaId.localeCompare(b.fromAreaId);
      return byFrom !== 0 ? byFrom : a.toAreaId.localeCompare(b.toAreaId);
    });

  const ports: FleetPort[] = snapshot.world.ports
    .filter((port) => port.nationId === playerSlotId)
    .map((port) => ({
      id: port.id,
      name: port.name,
      areaId: port.areaId,
      capacity: Number(port.level),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const overBaseShips: FleetOverBaseShip[] = nation.fleets
    .flatMap((fleet) =>
      fleet.ships
        .filter((ship) => ship.overBase !== undefined)
        .map((ship) => ({ shipId: ship.id, name: ship.name, areaId: ship.locationAreaId })),
    )
    .sort((a, b) => a.shipId.localeCompare(b.shipId));

  return {
    divisions,
    areas,
    areaEdges,
    ports,
    presence:
      presence === undefined
        ? { configured: false }
        : buildPresenceReadout(snapshot, playerSlotId, presence.month, presence.rules),
    overBaseShips,
  };
}
