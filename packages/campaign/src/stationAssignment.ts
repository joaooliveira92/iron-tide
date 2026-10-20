// S-5 (spec #73, R1/R2): the foreign-station assignment is a station state orthogonal to the S-1 readiness state
// (decision A). A ship on foreign station is ACTIVE and keeps its ACTIVE maintenance, crew and battle eligibility; the
// assignment only marks it. Rules here are pure and value-free: no tonnage, requirement or penalty number lives here.
import { isShipOperational, type Ship } from "./state.js";
import type { ShipReadinessState } from "./readiness.js";

/** The station assignments a ship may carry. Absent means no assignment. */
export const STATION_ASSIGNMENTS = ["FOREIGN_STATION"] as const;
export type StationAssignment = (typeof STATION_ASSIGNMENTS)[number];

/** Why a ship cannot take part in an assign or clear batch. One stable code per case. */
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

/** Reason codes recorded on a `ShipStationAssignmentChanged` event. */
export const STATION_ASSIGNED_REASON = "ASSIGNED" as const;
export const STATION_CLEARED_BY_COMMAND_REASON = "CLEARED_BY_COMMAND" as const;
export const STATION_CLEARED_BY_READINESS_REASON = "READINESS_LEFT_ACTIVE" as const;

/**
 * Check a whole assign or clear batch for a nation. Returns every ineligible ship with exactly one reason, ordered by
 * ship id; an empty array means the batch is acceptable. The caller rejects the whole batch when this is not empty.
 * Ship checks run in a fixed order: owned, commissioned, operational, ACTIVE, then the assignment state itself.
 */
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

function shipProblem(
  ship: Ship | undefined,
  intent: StationAssignmentIntent,
): StationAssignmentReason | null {
  if (ship === undefined) return "NOT_OWNED";
  if (intent === "clear") return ship.stationAssignment === undefined ? "NOT_ASSIGNED" : null;
  if (ship.isUnderConstruction) return "UNDER_CONSTRUCTION";
  if (!isShipOperational(ship)) return "NOT_OPERATIONAL";
  if (ship.readiness !== "ACTIVE") return "NOT_ACTIVE";
  if (ship.stationAssignment !== undefined) return "ALREADY_ASSIGNED";
  return null;
}

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The ship with the assignment applied (`assign`) or removed (`clear`). The input is not mutated. */
export function withStationAssignment(ship: Ship, intent: StationAssignmentIntent): Ship {
  if (intent === "assign") return { ...ship, stationAssignment: "FOREIGN_STATION" };
  const { stationAssignment: _cleared, ...rest } = ship;
  return rest;
}

export interface ShipReadinessSetResult {
  readonly ship: Ship;
  /** True when the ship carried an assignment that this readiness change removed. */
  readonly clearedAssignment: boolean;
}

/**
 * The single seam for changing a ship's readiness state. Any readiness other than ACTIVE clears the station
 * assignment (R1); the caller records the typed events. Crew, repair counters and everything else stay the caller's
 * business, so this never alters S-1 behaviour.
 */
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
