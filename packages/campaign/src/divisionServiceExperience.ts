import { SafeInt } from "@bluewave/contracts";

import { divisionAggregateHash, type PermanentDivision } from "./division.js";
import { isGrowthMember, type GrowthMember } from "./divisionCohesionGrowth.js";

export interface DivisionServiceExperienceRules {
  readonly monthlyGrowth: number;
  readonly cap: number;
}

export function growDivisionServiceExperience(
  division: PermanentDivision,
  shipsById: ReadonlyMap<string, GrowthMember>,
  month: string,
  rules: DivisionServiceExperienceRules,
): PermanentDivision {
  if (division.lastReorganizationMonth === month) return division;
  if (division.shipOrder.length === 0) return division;
  if (!division.shipOrder.every((shipId) => isGrowthMember(shipsById.get(shipId)))) return division;

  const current = division.experience as number;
  const grown = Math.min(100, rules.cap, current + rules.monthlyGrowth);
  if (grown <= current) return division;

  const next: PermanentDivision = { ...division, experience: SafeInt(grown), aggregateHash: "" };
  next.aggregateHash = divisionAggregateHash(next);
  return next;
}
