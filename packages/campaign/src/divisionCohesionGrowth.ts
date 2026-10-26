import { SafeInt } from "@bluewave/contracts";

import { divisionAggregateHash, type PermanentDivision } from "./division.js";
import type { Ship } from "./state.js";

export interface DivisionCohesionGrowthRules {
  readonly monthlyGrowth: number;
  readonly cap: number;
}

type GrowthMember = Pick<Ship, "id" | "readiness" | "isUnderConstruction" | "availability">;

function isGrowthMember(ship: GrowthMember | undefined): boolean {
  return (
    ship !== undefined &&
    ship.readiness === "ACTIVE" &&
    !ship.isUnderConstruction &&
    ship.availability !== "UNAVAILABLE"
  );
}

export function growDivisionCohesion(
  division: PermanentDivision,
  shipsById: ReadonlyMap<string, GrowthMember>,
  month: string,
  rules: DivisionCohesionGrowthRules,
): PermanentDivision {
  if (division.lastReorganizationMonth === month) return division;
  if (division.shipOrder.length === 0) return division;
  if (!division.shipOrder.every((shipId) => isGrowthMember(shipsById.get(shipId)))) return division;

  const current = division.cohesion as number;
  const grown = Math.min(rules.cap, current + rules.monthlyGrowth);
  if (grown <= current) return division;

  const next: PermanentDivision = { ...division, cohesion: SafeInt(grown), aggregateHash: "" };
  next.aggregateHash = divisionAggregateHash(next);
  return next;
}
