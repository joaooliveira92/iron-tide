import { Schema } from "effect";
import { SafeInt } from "@bluewave/contracts";

import { firstGateReason, type GateReasonTag } from "./eligibility.js";
import type { DiplomaticRelation, NationState, Ship } from "./state.js";
import { advanceMonth } from "./timeline.js";

export const FLEET_EXERCISE_DORMANT = "FLEET_EXERCISE_DORMANT" as const;
export const FLEET_EXERCISE_LIMIT_REACHED = "FLEET_EXERCISE_LIMIT_REACHED" as const;
export const FLEET_EXERCISE_REJECTED = "FLEET_EXERCISE_REJECTED" as const;

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

export const FleetExerciseRecordSchema = Schema.Struct({
  month: Schema.String.check(Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/)),
  year: nonNegativeInt,
  yearCount: nonNegativeInt,
  shipIds: Schema.Array(Schema.NonEmptyString),
  maintenanceAdderBp: nonNegativeInt,
});
export type FleetExerciseRecord = typeof FleetExerciseRecordSchema.Type;

export interface ExerciseTensionRules {
  readonly minShips: number;
  readonly increase: number;
  readonly ceiling: number;
}

export interface FleetExerciseRules {
  readonly maintenanceMultiple: number;
  readonly maxPerCalendarYear: number;
  readonly tension?: ExerciseTensionRules;
}

export function applyExerciseTension(
  relations: readonly DiplomaticRelation[],
  nationId: string,
  participants: number,
  rules: ExerciseTensionRules | undefined,
): readonly DiplomaticRelation[] {
  if (rules === undefined || participants < rules.minShips) return relations;
  return relations.map((relation) => {
    const involved = relation.nationA === nationId || relation.nationB === nationId;
    if (!involved || relation.relation !== "neutral") return relation;
    const raised = Math.min(rules.ceiling, relation.tension + rules.increase);
    return raised > relation.tension ? { ...relation, tension: raised } : relation;
  });
}

export type FleetExerciseProblemReason =
  | GateReasonTag
  | "EMPTY_BATCH"
  | "DUPLICATE_SHIP"
  | "NOT_OWNED";

export interface FleetExerciseProblem {
  readonly shipId: string;
  readonly reason: FleetExerciseProblemReason;
}

export function exerciseMonthAfter(month: string): {
  readonly month: string;
  readonly year: number;
} {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const next = advanceMonth(year, monthNumber, 1);
  return {
    month: `${String(next.year).padStart(4, "0")}-${String(next.month).padStart(2, "0")}`,
    year: next.year,
  };
}

export function exerciseYearCount(
  record: Pick<FleetExerciseRecord, "year" | "yearCount"> | undefined,
  year: number,
): number {
  return record !== undefined && record.year === year ? record.yearCount : 0;
}

export function exerciseLimitReached(
  record: Pick<FleetExerciseRecord, "year" | "yearCount"> | undefined,
  year: number,
  rules: Pick<FleetExerciseRules, "maxPerCalendarYear">,
): boolean {
  return exerciseYearCount(record, year) >= rules.maxPerCalendarYear;
}

export function exerciseProblems(
  nation: { readonly fleets: readonly { readonly ships: readonly Ship[] }[] },
  nationId: string,
  shipIds: readonly string[],
): FleetExerciseProblem[] {
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

  const problems: FleetExerciseProblem[] = [];
  for (const shipId of [...seen].sort(byId)) {
    const ship = owned.get(shipId);
    if (ship === undefined) {
      problems.push({ shipId, reason: "NOT_OWNED" });
      continue;
    }
    const reason = firstGateReason(ship, "TAKE_MISSION");
    if (reason !== null) problems.push({ shipId, reason: reason._tag });
  }
  return problems;
}

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function scheduleFleetExercise(
  nation: NationState,
  shipIds: readonly string[],
  campaignMonth: string,
  rules: FleetExerciseRules,
): NationState {
  const held = exerciseMonthAfter(campaignMonth);
  const ids = [...shipIds].sort(byId);
  const idSet = new Set(ids);
  const fleets = nation.fleets.map((fleet) => ({
    ...fleet,
    ships: fleet.ships.map((ship) =>
      idSet.has(ship.id) ? { ...ship, stationAssignment: "EXERCISE" as const } : ship,
    ),
  }));
  const record: FleetExerciseRecord = {
    month: held.month,
    year: held.year,
    yearCount: exerciseYearCount(nation.fleetExercise, held.year) + 1,
    shipIds: ids,
    maintenanceAdderBp: (rules.maintenanceMultiple - 1) * 10_000,
  };
  return { ...nation, fleets, fleetExercise: record };
}

export function exerciseMaintenanceAdderBp(
  record: Pick<FleetExerciseRecord, "month" | "maintenanceAdderBp"> | undefined,
  month: string,
): SafeInt | undefined {
  return record !== undefined && record.month === month
    ? SafeInt(record.maintenanceAdderBp)
    : undefined;
}

export function completeFleetExercise(
  nation: NationState,
  campaignMonth: string,
  experienceGain: number,
): NationState {
  const record = nation.fleetExercise;
  if (record === undefined || record.month !== campaignMonth) return nation;
  const exercising = new Set(record.shipIds);
  const fleets = nation.fleets.map((fleet) => ({
    ...fleet,
    ships: fleet.ships.map((ship) => {
      if (!exercising.has(ship.id) || ship.stationAssignment !== "EXERCISE") return ship;
      const { stationAssignment: _released, ...rest } = ship;
      return rest;
    }),
  }));
  const divisions = nation.divisions.map((division) =>
    division.shipOrder.some((shipId) => exercising.has(shipId))
      ? {
          ...division,
          experience: SafeInt(Math.min(100, (division.experience as number) + experienceGain)),
        }
      : division,
  );
  return { ...nation, fleets, divisions };
}
