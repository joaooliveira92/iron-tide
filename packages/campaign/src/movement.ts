import { evaluateShipGates, type GateReasonTag, type ShipGateSubject } from "./eligibility.js";
import { isSeaArea } from "./seaArea.js";
import type { CampaignSnapshot, NationState } from "./state.js";

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
  snapshot: Pick<CampaignSnapshot, "nations" | "world">,
  nationId: string,
  fleetId: string,
  toAreaId: string,
): FleetMoveProblem | null {
  const nation = snapshot.nations.get(nationId);
  if (!nation) return { code: "INVALID_NATION_ID", message: `Nation ${nationId} not found` };
  const fleet = nation.fleets.find((f) => f.id === fleetId);
  if (!fleet)
    return { code: "INVALID_COMMAND_PAYLOAD", message: `Fleet ${fleetId} is not ${nationId}'s` };
  const stationed = fleet.ships.find((s) => hasSailGate(s, "AssignmentForbidsUse"));
  if (stationed !== undefined)
    return {
      code: "FOREIGN_STATION_ASSIGNED",
      message: `${stationed.name} is on foreign station and is routed by the month; clear its assignment before ordering fleet ${fleet.name} to move`,
    };
  if (
    !fleet.ships.some((s) => !hasSailGate(s, "UnderConstruction") && !hasSailGate(s, "Unavailable"))
  )
    return {
      code: "SHIP_NOT_OPERATIONAL",
      message: `Fleet ${fleet.name} has no commissioned ship`,
    };
  const unavailable = fleet.ships.find((s) => hasSailGate(s, "Unavailable"));
  if (unavailable !== undefined)
    return {
      code: "SHIP_UNAVAILABLE",
      message: `${unavailable.name} is under rebuild and cannot sail; fleet ${fleet.name} cannot move with it`,
    };
  const target = snapshot.world.areas.find((a) => a.id === toAreaId);
  if (!target) return { code: "INVALID_ROUTE", message: `Unknown destination area ${toAreaId}` };
  if (!isSeaArea(target))
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

export function relocateFleet<S extends Pick<CampaignSnapshot, "nations">>(
  snapshot: S,
  nationId: string,
  fleetId: string,
  toAreaId: string,
): S {
  const nation = snapshot.nations.get(nationId);
  const moved = nation?.fleets.find((f) => f.id === fleetId);
  if (nation === undefined || moved === undefined) return snapshot;
  const movedShipIds = new Set(moved.ships.map((s) => s.id));
  const updatedNation: NationState = {
    ...nation,
    fleets: nation.fleets.map((fleet) =>
      fleet.id === fleetId
        ? {
            ...fleet,
            locationAreaId: toAreaId,
            ships: fleet.ships.map((s) => ({ ...s, locationAreaId: toAreaId })),
          }
        : fleet,
    ),
    divisions: nation.divisions.map((d) =>
      movedShipIds.has(d.flagshipShipId) ? { ...d, locationAreaId: toAreaId } : d,
    ),
  };
  const updatedNations = new Map(snapshot.nations);
  updatedNations.set(nationId, updatedNation);
  return { ...snapshot, nations: updatedNations };
}

function hasSailGate(ship: ShipGateSubject, tag: GateReasonTag): boolean {
  return evaluateShipGates(ship, "SAIL").some((reason) => reason._tag === tag);
}
