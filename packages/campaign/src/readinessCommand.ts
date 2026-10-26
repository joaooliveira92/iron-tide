import type { Ship } from "./state.js";

export const COMMANDABLE_READINESS = ["ACTIVE", "RESERVE", "MOTHBALLED"] as const;
export type CommandableReadiness = (typeof COMMANDABLE_READINESS)[number];

export const READINESS_COMMAND_REASONS = [
  "EMPTY_BATCH",
  "DUPLICATE_SHIP",
  "NOT_OWNED",
  "UNDER_CONSTRUCTION",
  "UNAVAILABLE",
  "WORKING_UP",
  "REPAIR_IN_PROGRESS",
  "IN_BATTLE",
  "ASSIGNMENT_HELD",
  "ALREADY_IN_STATE",
] as const;
export type ReadinessCommandReason = (typeof READINESS_COMMAND_REASONS)[number];

export interface ReadinessCommandProblem {
  readonly shipId: string;
  readonly reason: ReadinessCommandReason;
}

export const READINESS_SET_BY_COMMAND_REASON = "SET_BY_COMMAND" as const;

export function isCommandableReadiness(value: unknown): value is CommandableReadiness {
  return typeof value === "string" && (COMMANDABLE_READINESS as readonly string[]).includes(value);
}

export function readinessCommandProblems(
  nation: { readonly fleets: readonly { readonly ships: readonly Ship[] }[] },
  nationId: string,
  shipIds: readonly string[],
  target: CommandableReadiness,
): ReadinessCommandProblem[] {
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

  const problems: ReadinessCommandProblem[] = [];
  for (const shipId of [...seen].sort(byId)) {
    const reason = shipProblem(owned.get(shipId), target);
    if (reason !== null) problems.push({ shipId, reason });
  }
  return problems;
}

function shipProblem(
  ship: Ship | undefined,
  target: CommandableReadiness,
): ReadinessCommandReason | null {
  if (ship === undefined) return "NOT_OWNED";
  if (ship.isUnderConstruction) return "UNDER_CONSTRUCTION";
  if (ship.availability === "UNAVAILABLE") return "UNAVAILABLE";
  if (ship.readiness === "WORKING_UP") return "WORKING_UP";
  if (ship.readiness === "REPAIR" && target !== "MOTHBALLED") return "REPAIR_IN_PROGRESS";
  if (ship.inBattleId !== undefined) return "IN_BATTLE";
  if (target !== "ACTIVE" && ship.stationAssignment !== undefined) return "ASSIGNMENT_HELD";
  if (ship.readiness === target) return "ALREADY_IN_STATE";
  return null;
}

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
