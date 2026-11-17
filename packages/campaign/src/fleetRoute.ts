import { fleetMoveProblem, orderedShips, relocateFleet } from "./movement.js";
import { nextHopToward, seaAdjacency } from "./seaRoute.js";
import type { CampaignSnapshot, FleetState, NationState } from "./state.js";

type RouteSnapshot = Pick<CampaignSnapshot, "nations" | "world">;

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function detachedMoveFleetId(nation: NationState, shipIds: readonly string[]): string {
  const lead = [...shipIds].sort(byId)[0] ?? "ship";
  const base = `fleet-mv-${lead}`;
  const taken = new Set(nation.fleets.map((f) => f.id));
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

function withFleets<S extends Pick<CampaignSnapshot, "nations">>(
  snapshot: S,
  nationId: string,
  nation: NationState,
  fleets: FleetState[],
): S {
  const nations = new Map(snapshot.nations);
  nations.set(nationId, { ...nation, fleets });
  return { ...snapshot, nations };
}

function withDestination(fleet: FleetState, destinationAreaId: string | undefined): FleetState {
  const { destinationAreaId: _previous, ...rest } = fleet;
  return destinationAreaId === undefined ? rest : { ...rest, destinationAreaId };
}

export function isWholeFleet(fleet: FleetState, shipIds: readonly string[] | undefined): boolean {
  return (
    shipIds === undefined ||
    shipIds.length === 0 ||
    fleet.ships.every((s) => shipIds.includes(s.id))
  );
}

export function orderFleetRoute<S extends RouteSnapshot>(
  snapshot: S,
  nationId: string,
  fleetId: string,
  toAreaId: string,
  shipIds?: readonly string[],
): { readonly snapshot: S; readonly routedFleetId: string } {
  const nation = snapshot.nations.get(nationId);
  const fleet = nation?.fleets.find((f) => f.id === fleetId);
  if (nation === undefined || fleet === undefined) return { snapshot, routedFleetId: fleetId };
  if (isWholeFleet(fleet, shipIds)) {
    return {
      snapshot: withFleets(
        snapshot,
        nationId,
        nation,
        nation.fleets.map((f) => (f.id === fleetId ? withDestination(f, toAreaId) : f)),
      ),
      routedFleetId: fleetId,
    };
  }
  const ships = orderedShips(fleet.ships, shipIds);
  const routedFleetId = detachedMoveFleetId(
    nation,
    ships.map((s) => s.id),
  );
  const detached: FleetState = {
    id: routedFleetId,
    nationId,
    name: ships.length === 1 ? ships[0]!.name : `${fleet.name} detachment`,
    locationAreaId: fleet.locationAreaId,
    destinationAreaId: toAreaId,
    ships,
  };
  const ordered = new Set(ships.map((s) => s.id));
  return {
    snapshot: withFleets(snapshot, nationId, nation, [
      ...nation.fleets.map((f) =>
        f.id === fleetId ? { ...f, ships: f.ships.filter((s) => !ordered.has(s.id)) } : f,
      ),
      detached,
    ]),
    routedFleetId,
  };
}

export function advanceFleetRoute<S extends RouteSnapshot>(
  snapshot: S,
  nationId: string,
  fleetId: string,
): S {
  const nation = snapshot.nations.get(nationId);
  const fleet = nation?.fleets.find((f) => f.id === fleetId);
  if (nation === undefined || fleet === undefined) return snapshot;
  const destination = fleet.destinationAreaId;
  if (destination === undefined) return snapshot;
  const halt = (): S =>
    withFleets(
      snapshot,
      nationId,
      nation,
      nation.fleets.map((f) => (f.id === fleetId ? withDestination(f, undefined) : f)),
    );
  if (fleetMoveProblem(snapshot, nationId, fleetId, destination) !== null) return halt();
  const next = nextHopToward(fleet.locationAreaId, destination, seaAdjacency(snapshot.world));
  if (next === null) return halt();
  const moved = relocateFleet(snapshot, nationId, fleetId, next);
  const movedNation = moved.nations.get(nationId)!;
  return withFleets(
    moved,
    nationId,
    movedNation,
    movedNation.fleets.map((f) =>
      f.id === fleetId ? withDestination(f, next === destination ? undefined : destination) : f,
    ),
  );
}

export function advanceFleetRoutes<S extends RouteSnapshot>(snapshot: S): S {
  let current = snapshot;
  for (const nationId of [...snapshot.nations.keys()].sort(byId)) {
    const moving = snapshot.nations
      .get(nationId)!
      .fleets.filter((f) => f.destinationAreaId !== undefined)
      .map((f) => f.id)
      .sort(byId);
    for (const fleetId of moving) current = advanceFleetRoute(current, nationId, fleetId);
  }
  return current;
}
