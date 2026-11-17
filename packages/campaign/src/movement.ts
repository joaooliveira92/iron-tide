import { evaluateShipGates, type GateReasonTag, type ShipGateSubject } from "./eligibility.js";
import { isSeaArea } from "./seaArea.js";
import type { CampaignSnapshot, NationState } from "./state.js";

export type FleetMoveProblem =
  | {
      readonly _tag: "UnknownNation";
      readonly code: "INVALID_NATION_ID";
      readonly nationId: string;
    }
  | {
      readonly _tag: "FleetNotOwned";
      readonly code: "INVALID_COMMAND_PAYLOAD";
      readonly nationId: string;
      readonly fleetId: string;
    }
  | {
      readonly _tag: "ForeignStationPosted";
      readonly code: "FOREIGN_STATION_ASSIGNED";
      readonly fleetId: string;
      readonly shipId: string;
    }
  | {
      readonly _tag: "NoCommissionedShip";
      readonly code: "SHIP_NOT_OPERATIONAL";
      readonly fleetId: string;
    }
  | {
      readonly _tag: "ShipUnderRebuild";
      readonly code: "SHIP_UNAVAILABLE";
      readonly fleetId: string;
      readonly shipId: string;
    }
  | { readonly _tag: "UnknownArea"; readonly code: "INVALID_ROUTE"; readonly areaId: string }
  | { readonly _tag: "LandArea"; readonly code: "INVALID_ROUTE"; readonly areaId: string }
  | {
      readonly _tag: "AlreadyThere";
      readonly code: "INVALID_ROUTE";
      readonly fleetId: string;
      readonly areaId: string;
    }
  | {
      readonly _tag: "NoSeaRoute";
      readonly code: "INVALID_ROUTE";
      readonly fromAreaId: string;
      readonly toAreaId: string;
    };

export function describeFleetMoveProblem(problem: FleetMoveProblem): string {
  const { _tag, code: _code, ...fields } = problem;
  const detail = Object.entries(fields)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  return detail === "" ? _tag : `${_tag} ${detail}`;
}

export function fleetMoveProblem(
  snapshot: Pick<CampaignSnapshot, "nations" | "world">,
  nationId: string,
  fleetId: string,
  toAreaId: string,
): FleetMoveProblem | null {
  const nation = snapshot.nations.get(nationId);
  if (!nation) return { _tag: "UnknownNation", code: "INVALID_NATION_ID", nationId };
  const fleet = nation.fleets.find((f) => f.id === fleetId);
  if (!fleet) return { _tag: "FleetNotOwned", code: "INVALID_COMMAND_PAYLOAD", nationId, fleetId };
  const stationed = fleet.ships.find((s) => hasSailGate(s, "AssignmentForbidsUse"));
  if (stationed !== undefined)
    return {
      _tag: "ForeignStationPosted",
      code: "FOREIGN_STATION_ASSIGNED",
      fleetId,
      shipId: stationed.id,
    };
  if (
    !fleet.ships.some((s) => !hasSailGate(s, "UnderConstruction") && !hasSailGate(s, "Unavailable"))
  )
    return { _tag: "NoCommissionedShip", code: "SHIP_NOT_OPERATIONAL", fleetId };
  const unavailable = fleet.ships.find((s) => hasSailGate(s, "Unavailable"));
  if (unavailable !== undefined)
    return {
      _tag: "ShipUnderRebuild",
      code: "SHIP_UNAVAILABLE",
      fleetId,
      shipId: unavailable.id,
    };
  const target = snapshot.world.areas.find((a) => a.id === toAreaId);
  if (!target) return { _tag: "UnknownArea", code: "INVALID_ROUTE", areaId: toAreaId };
  if (!isSeaArea(target)) return { _tag: "LandArea", code: "INVALID_ROUTE", areaId: toAreaId };
  if (fleet.locationAreaId === toAreaId)
    return { _tag: "AlreadyThere", code: "INVALID_ROUTE", fleetId, areaId: toAreaId };
  const connected = snapshot.world.routes.some(
    (r) =>
      r.type === "sea" &&
      ((r.from === fleet.locationAreaId && r.to === toAreaId) ||
        (r.to === fleet.locationAreaId && r.from === toAreaId)),
  );
  if (!connected)
    return {
      _tag: "NoSeaRoute",
      code: "INVALID_ROUTE",
      fromAreaId: fleet.locationAreaId,
      toAreaId,
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
