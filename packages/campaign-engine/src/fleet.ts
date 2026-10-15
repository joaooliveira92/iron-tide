import type { CampaignSnapshot } from "@bluewave/campaign";

/**
 * Fleet-screen projections (desktop-mvp ticket 15). Everything here is a
 * pure, deterministic derivation over the compiled `CampaignSnapshot` — no
 * session state, no I/O, no randomness — so the desktop bridge can build the
 * shared `FleetScreenProjection`'s divisions/areas/edges/ports from the
 * exact same immutable snapshot every `inspectFleetScreen` call, and tests
 * can pin the derivation against fixture data.
 *
 * Divisions are the player nation's compiled `FleetState`s: the campaign
 * compiler never populates `nation.divisions` (every compiled nation has
 * `divisions: []`, so there are no `PermanentDivision` records in any
 * compiled campaign today), and the engine's ship groupings live on
 * `FleetState.ships`. `buildPlayerProjection` (projection.ts, ticket 12)
 * already established this repo convention — each compiled `FleetState`
 * becomes one division view carrying all of its ships.
 *
 * Ship `status` is a presentation derivation of the only real status datum
 * the compiled `Ship` carries (`isUnderConstruction`), in the same class as
 * `constructionShipTypeLabel`'s display mapping — the renderer shows ship
 * names only, never this string.
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
  readonly status: string;
}

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
 *   ships in compiled order, `status` derived from `isUnderConstruction`).
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
      status: ship.isUnderConstruction ? "under_construction" : "commissioned",
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
