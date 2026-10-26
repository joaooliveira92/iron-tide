import { firstGateReason, type GateReasonTag } from "./eligibility.js";
import type { Ship } from "./state.js";
import type { ShipReadinessState } from "./readiness.js";

export const STATION_ASSIGNMENTS = ["FOREIGN_STATION", "EXERCISE"] as const;
export type StationAssignment = (typeof STATION_ASSIGNMENTS)[number];

export const STATION_ASSIGNMENT_REASONS = [
  "EMPTY_BATCH",
  "DUPLICATE_SHIP",
  "NOT_OWNED",
  "UNDER_CONSTRUCTION",
  "NOT_OPERATIONAL",
  "NOT_ACTIVE",
  "ALREADY_ASSIGNED",
  "NOT_ASSIGNED",
] as const;
export type StationAssignmentReason = (typeof STATION_ASSIGNMENT_REASONS)[number];

export interface StationAssignmentProblem {
  readonly shipId: string;
  readonly reason: StationAssignmentReason;
}

export type StationAssignmentIntent = "assign" | "clear";

export const STATION_ASSIGNED_REASON = "ASSIGNED" as const;
export const STATION_CLEARED_BY_COMMAND_REASON = "CLEARED_BY_COMMAND" as const;
export const STATION_CLEARED_BY_READINESS_REASON = "READINESS_LEFT_ACTIVE" as const;

export function stationAssignmentProblems(
  nation: { readonly fleets: readonly { readonly ships: readonly Ship[] }[] },
  nationId: string,
  shipIds: readonly string[],
  intent: StationAssignmentIntent,
): StationAssignmentProblem[] {
  if (shipIds.length === 0) return [{ shipId: "", reason: "EMPTY_BATCH" }];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of shipIds) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (duplicates.size > 0) {
    return [...duplicates].sort(byId).map((shipId) => ({ shipId, reason: "DUPLICATE_SHIP" }));
  }

  const owned = new Map<string, Ship>();
  for (const fleet of nation.fleets) {
    for (const ship of fleet.ships) {
      if (ship.nationId === nationId) owned.set(ship.id, ship);
    }
  }

  const problems: StationAssignmentProblem[] = [];
  for (const shipId of [...seen].sort(byId)) {
    const reason = shipProblem(owned.get(shipId), intent);
    if (reason !== null) problems.push({ shipId, reason });
  }
  return problems;
}

const STATION_REASON_BY_GATE: Readonly<Record<GateReasonTag, StationAssignmentReason>> = {
  UnderConstruction: "UNDER_CONSTRUCTION",
  Unavailable: "NOT_OPERATIONAL",
  WorkingUp: "NOT_ACTIVE",
  InRepair: "NOT_ACTIVE",
  InReserve: "NOT_ACTIVE",
  Mothballed: "NOT_ACTIVE",
  InBattle: "NOT_ACTIVE",
  Assigned: "ALREADY_ASSIGNED",
  AssignmentForbidsUse: "ALREADY_ASSIGNED",
};

function shipProblem(
  ship: Ship | undefined,
  intent: StationAssignmentIntent,
): StationAssignmentReason | null {
  if (ship === undefined) return "NOT_OWNED";
  if (intent === "clear")
    return ship.stationAssignment === "FOREIGN_STATION" ? null : "NOT_ASSIGNED";
  const reason = firstGateReason(ship, "HOLD_STATION");
  if (reason !== null) return STATION_REASON_BY_GATE[reason._tag];
  return null;
}

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function withStationAssignment(ship: Ship, intent: StationAssignmentIntent): Ship {
  if (intent === "assign") return { ...ship, stationAssignment: "FOREIGN_STATION" };
  const { stationAssignment: _cleared, ...rest } = ship;
  return rest;
}

export interface ShipReadinessSetResult {
  readonly ship: Ship;
  readonly clearedAssignment: boolean;
}

export function setShipReadiness(
  ship: Ship,
  readiness: ShipReadinessState,
): ShipReadinessSetResult {
  const next: Ship = { ...ship, readiness };
  if (readiness === "ACTIVE" || ship.stationAssignment === undefined) {
    return { ship: next, clearedAssignment: false };
  }
  return { ship: withStationAssignment(next, "clear"), clearedAssignment: true };
}
