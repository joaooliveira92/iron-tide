import type { CampaignSnapshot } from "@bluewave/campaign";

/**
 * Fleet-screen projections (desktop-mvp ticket 15). Everything here is a
 * pure, deterministic derivation over the compiled `CampaignSnapshot` — no
 * session state, no I/O, no randomness — so the desktop bridge can build the
 * shared `FleetScreenProjection`'s divisions/areas/edges/ports from the
 * exact same immutable snapshot every `inspectFleetScreen` call, and tests
 * can pin the derivation against fixture data.
 *
 * Divisions are the player nation's compiled `FleetState`s. The campaign
 * compiler also seeds `nation.divisions` from authored content (N-1 ticket 07);
 * this screen predates that command structure and keeps its established
 * convention that each compiled `FleetState` becomes one division view carrying
 * all of its ships (`buildPlayerProjection`, projection.ts, ticket 12).
 *
 * Ship `status` is a presentation derivation of the ship's authoritative
 * readiness state (S-1 ticket 07; the `READINESS_STATUS_LABEL` mapping), in the
 * same class as `constructionShipTypeLabel`'s display mapping.
 */

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

/** One ship on the fleet screen — `designId` is the compiled `designVersionId`
 * (the production pack's ships all lack one today; the empty string is the
 * honest reflection of that pre-existing content gap). */
export interface FleetShipView {
  readonly name: string;
  readonly designId: string;
  /** Presentation status derived from the ship's readiness state (S-1 ticket 07). */
  readonly status: string;
  /** The authoritative readiness state (S-1 ticket 07). */
  readonly readiness: string;
  /** Worked-up crew quality `0..100` (S-1 ticket 07). */
  readonly crewQuality: number;
  /** The authoritative station assignment (S-5 03); absent when the ship has none. */
  readonly stationAssignment?: "FOREIGN_STATION";
  /** The manual's ship-list code for the assignment (p.48 `FS`); absent when the ship has none. */
  readonly stationCode?: "FS";
}

/** The readiness state's presentation label (S-1 ticket 07). */
const READINESS_STATUS_LABEL: Readonly<Record<string, string>> = {
  ACTIVE: "active",
  RESERVE: "reserve",
  MOTHBALLED: "mothballed",
  WORKING_UP: "working_up",
  REPAIR: "repair",
};

/** One compiled `FleetState` as the Fleet screen sees it (see header note). */
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

/** A directed adjacency between two areas, from the compiled world routes. */
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

/** The pure snapshot-derived portion of the shared `FleetScreenProjection`. */
export interface FleetScreenView {
  readonly divisions: readonly FleetDivisionView[];
  readonly areas: readonly FleetArea[];
  readonly areaEdges: readonly FleetAreaEdge[];
  readonly ports: readonly FleetPort[];
}

/**
 * Builds the Fleet screen's divisions/areas/edges/ports for `playerSlotId`
 * from a real compiled `CampaignSnapshot`:
 * - `divisions`: one per compiled `FleetState` of the player nation (its
 *   ships in compiled order, `status` derived from the readiness state).
 * - `areas`: the full compiled world area map (`{id, name}`).
 * - `areaEdges`: the compiled world routes (`{from,to}`) as directed edges.
 * - `ports`: the player nation's own ports, `capacity` = authored `level`
 *   (the same port-level proxy `buildPlayerProjection` uses, ticket 12).
 * Returns an empty view when `playerSlotId` doesn't resolve to a nation.
 */
export function buildFleetScreenView(
  snapshot: CampaignSnapshot,
  playerSlotId: string,
): FleetScreenView {
  const nation = snapshot.nations.get(playerSlotId);
  if (!nation) {
    return { divisions: [], areas: [], areaEdges: [], ports: [] };
  }

  const divisions: FleetDivisionView[] = nation.fleets.map((fleet) => ({
    divisionId: fleet.id,
    fleetName: fleet.name,
    areaId: fleet.locationAreaId,
    ships: fleet.ships.map((ship) => ({
      name: ship.name,
      designId: ship.designVersionId,
      status: READINESS_STATUS_LABEL[ship.readiness] ?? "active",
      readiness: ship.readiness,
      crewQuality: Number(ship.crewQuality),
      ...(ship.stationAssignment === undefined
        ? {}
        : { stationAssignment: ship.stationAssignment, stationCode: "FS" as const }),
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

  return { divisions, areas, areaEdges, ports };
}
