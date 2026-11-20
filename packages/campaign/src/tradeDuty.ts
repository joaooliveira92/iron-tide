import { firstGateReason, type GateReasonTag } from "./eligibility.js";
import type { Ship } from "./state.js";
import type { StationAssignmentProblem, StationAssignmentReason } from "./stationAssignment.js";

export const TRADE_DUTIES = ["TRADE_PROTECTION", "RAIDER", "NONE"] as const;
export type TradeDuty = (typeof TRADE_DUTIES)[number];

export const TRADE_DUTY_REJECTED = "TRADE_DUTY_REJECTED" as const;
export const TRADE_DUTY_DORMANT = "TRADE_DUTY_DORMANT" as const;
export const TRADE_DUTY_ASSIGNED_REASON = "TRADE_DUTY_ASSIGNED" as const;
export const TRADE_DUTY_CLEARED_REASON = "TRADE_DUTY_CLEARED" as const;

const REASON_BY_GATE: Readonly<Record<GateReasonTag, StationAssignmentReason>> = {
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

export function holdsTradeDuty(ship: Pick<Ship, "stationAssignment">): boolean {
  return ship.stationAssignment === "TRADE_PROTECTION" || ship.stationAssignment === "RAIDER";
}

export function tradeDutyProblems(
  nation: { readonly fleets: readonly { readonly ships: readonly Ship[] }[] },
  nationId: string,
  shipIds: readonly string[],
  duty: TradeDuty,
): StationAssignmentProblem[] {
  if (shipIds.length === 0) return [{ shipId: "", reason: "EMPTY_BATCH" }];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of shipIds) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  if (duplicates.size > 0)
    return [...duplicates].sort(byId).map((shipId) => ({ shipId, reason: "DUPLICATE_SHIP" }));

  const owned = new Map<string, Ship>();
  for (const fleet of nation.fleets)
    for (const ship of fleet.ships) if (ship.nationId === nationId) owned.set(ship.id, ship);

  const problems: StationAssignmentProblem[] = [];
  for (const shipId of [...seen].sort(byId)) {
    const reason = shipProblem(owned.get(shipId), duty);
    if (reason !== null) problems.push({ shipId, reason });
  }
  return problems;
}

function shipProblem(ship: Ship | undefined, duty: TradeDuty): StationAssignmentReason | null {
  if (ship === undefined) return "NOT_OWNED";
  if (duty === "NONE") return holdsTradeDuty(ship) ? null : "NOT_ASSIGNED";
  const { stationAssignment: _duty, ...free } = ship;
  const reason = firstGateReason(holdsTradeDuty(ship) ? free : ship, "HOLD_STATION");
  return reason === null ? null : REASON_BY_GATE[reason._tag];
}

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function withTradeDuty(ship: Ship, duty: TradeDuty): Ship {
  const { stationAssignment: _previous, stationAreaId: _station, ...rest } = ship;
  return duty === "NONE" ? rest : { ...rest, stationAssignment: duty };
}
