import { isShipOperational, type CampaignSnapshot } from "./state.js";

/**
 * Fleet movement rule (ADR-0062): a fleet sails one route hop per month, to an area
 * directly connected to where it is (routes are two-way), never onto land.
 * Pure, so the command validator and the month's apply step share one verdict.
 */
export interface FleetMoveProblem {
  readonly code:
    | "INVALID_NATION_ID"
    | "INVALID_COMMAND_PAYLOAD"
    | "INVALID_ROUTE"
    | "SHIP_NOT_OPERATIONAL"
    | "SHIP_UNAVAILABLE"
    | "FOREIGN_STATION_ASSIGNED";
  readonly message: string;
}

export function fleetMoveProblem(
  snapshot: CampaignSnapshot,
  nationId: string,
  fleetId: string,
  toAreaId: string,
): FleetMoveProblem | null {
  const nation = snapshot.nations.get(nationId);
  if (!nation) return { code: "INVALID_NATION_ID", message: `Nation ${nationId} not found` };
  const fleet = nation.fleets.find((f) => f.id === fleetId);
  if (!fleet)
    return { code: "INVALID_COMMAND_PAYLOAD", message: `Fleet ${fleetId} is not ${nationId}'s` };
  // S-5 (spec #73 R9): the month routes a foreign-station ship itself; a manual order is refused until the assignment is cleared.
  const stationed = fleet.ships.find((s) => s.stationAssignment !== undefined);
  if (stationed !== undefined)
    return {
      code: "FOREIGN_STATION_ASSIGNED",
      message: `${stationed.name} is on foreign station and is routed by the month; clear its assignment before ordering fleet ${fleet.name} to move`,
    };
  if (!fleet.ships.some((s) => isShipOperational(s)))
    return {
      code: "SHIP_NOT_OPERATIONAL",
      message: `Fleet ${fleet.name} has no commissioned ship`,
    };
  // A ship under rebuild or conversion cannot move (DESIGN-23 section 20): the fleet cannot sail with it aboard.
  const unavailable = fleet.ships.find((s) => s.availability === "UNAVAILABLE");
  if (unavailable !== undefined)
    return {
      code: "SHIP_UNAVAILABLE",
      message: `${unavailable.name} is under rebuild and cannot sail; fleet ${fleet.name} cannot move with it`,
    };
  const target = snapshot.world.areas.find((a) => a.id === toAreaId);
  if (!target) return { code: "INVALID_ROUTE", message: `Unknown destination area ${toAreaId}` };
  if (target.type === "land")
    return { code: "INVALID_ROUTE", message: `${target.name} is land; a fleet cannot sail there` };
  if (fleet.locationAreaId === toAreaId)
    return { code: "INVALID_ROUTE", message: `${fleet.name} is already in ${target.name}` };
  const connected = snapshot.world.routes.some(
    (r) =>
      r.type === "sea" &&
      ((r.from === fleet.locationAreaId && r.to === toAreaId) ||
        (r.to === fleet.locationAreaId && r.from === toAreaId)),
  );
  if (!connected)
    return {
      code: "INVALID_ROUTE",
      message: `${target.name} is not directly connected to ${fleet.locationAreaId}`,
    };
  return null;
}
