import { Result, Schema } from "effect";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { divisionAggregateHash, type PermanentDivision } from "../src/division.js";
import {
  completeFleetExercise,
  exerciseLimitReached,
  exerciseMaintenanceAdderBp,
  exerciseMonthAfter,
  exerciseProblems,
  FleetExerciseRecordSchema,
  scheduleFleetExercise,
} from "../src/fleetExercise.js";
import { stationAssignmentProblems } from "../src/stationAssignment.js";
import type { NationState, Ship } from "../src/state.js";

const ship = (id: string, over: Partial<Ship> = {}): Ship =>
  ({
    id,
    nationId: "GBR",
    readiness: "ACTIVE",
    isUnderConstruction: false,
    ...over,
  }) as Ship;

const division = (shipOrder: string[], experience: number): PermanentDivision => {
  const base = {
    divisionId: `d-${shipOrder[0]}`,
    nationId: "GBR",
    shipOrder,
    flagshipShipId: shipOrder[0]!,
    experience: SafeInt(experience),
    cohesion: SafeInt(30),
  } as PermanentDivision;
  return { ...base, aggregateHash: divisionAggregateHash(base) };
};

const nation = (ships: Ship[], divisions: PermanentDivision[] = []): NationState =>
  ({ id: "GBR", fleets: [{ ships }], divisions }) as NationState;

describe("exerciseMonthAfter", () => {
  it("rolls into the next calendar year from December", () => {
    expect(exerciseMonthAfter("1880-12")).toEqual({ month: "1881-01", year: 1881 });
    expect(exerciseMonthAfter("1880-02")).toEqual({ month: "1880-03", year: 1880 });
  });
});

describe("exerciseLimitReached", () => {
  it("counts only the record of the same calendar year", () => {
    const record = { year: 1880, yearCount: 1 };
    expect(exerciseLimitReached(record, 1880, { maxPerCalendarYear: 1 })).toBe(true);
    expect(exerciseLimitReached(record, 1881, { maxPerCalendarYear: 1 })).toBe(false);
    expect(exerciseLimitReached(undefined, 1880, { maxPerCalendarYear: 1 })).toBe(false);
    expect(exerciseLimitReached(undefined, 1880, { maxPerCalendarYear: 0 })).toBe(true);
  });
});

describe("exerciseProblems", () => {
  const fleet = nation([
    ship("a"),
    ship("b", { readiness: "RESERVE" }),
    ship("c", { stationAssignment: "FOREIGN_STATION" }),
    ship("d", { inBattleId: "battle-1" }),
  ]);

  it("names each ineligible ship with its gate code, in id order", () => {
    expect(exerciseProblems(fleet, "GBR", ["d", "c", "b", "a"])).toEqual([
      { shipId: "b", reason: "InReserve" },
      { shipId: "c", reason: "Assigned" },
      { shipId: "d", reason: "InBattle" },
    ]);
  });

  it("refuses an empty batch, duplicates and ships the nation does not own", () => {
    expect(exerciseProblems(fleet, "GBR", [])).toEqual([{ shipId: "", reason: "EMPTY_BATCH" }]);
    expect(exerciseProblems(fleet, "GBR", ["a", "a"])).toEqual([
      { shipId: "a", reason: "DUPLICATE_SHIP" },
    ]);
    expect(exerciseProblems(fleet, "GBR", ["zzz"])).toEqual([
      { shipId: "zzz", reason: "NOT_OWNED" },
    ]);
    expect(exerciseProblems(fleet, "GBR", ["a"])).toEqual([]);
  });
});

describe("scheduling and completing", () => {
  const rules = { maintenanceMultiple: 2, maxPerCalendarYear: 1 };

  it("occupies the slot now, prices the exercise month only and releases at completion", () => {
    const scheduled = scheduleFleetExercise(
      nation([ship("a"), ship("b")], [division(["a"], 98), division(["b"], 10)]),
      ["a"],
      "1880-11",
      rules,
    );
    expect(scheduled.fleets[0]!.ships[0]!.stationAssignment).toBe("EXERCISE");
    expect(scheduled.fleetExercise).toMatchObject({ month: "1880-12", year: 1880, yearCount: 1 });
    expect(exerciseMaintenanceAdderBp(scheduled.fleetExercise, "1880-11")).toBeUndefined();
    expect(exerciseMaintenanceAdderBp(scheduled.fleetExercise, "1880-12") as number).toBe(10000);

    expect(completeFleetExercise(scheduled, "1880-11", 5)).toBe(scheduled);
    const done = completeFleetExercise(scheduled, "1880-12", 5);
    expect(done.fleets[0]!.ships[0]!.stationAssignment).toBeUndefined();
    expect(done.divisions.map((d) => d.experience as number)).toEqual([100, 10]);
  });

  it("a station clear command cannot release an exercising ship", () => {
    const scheduled = scheduleFleetExercise(nation([ship("a")]), ["a"], "1880-01", rules);
    expect(stationAssignmentProblems(scheduled, "GBR", ["a"], "clear")).toEqual([
      { shipId: "a", reason: "NOT_ASSIGNED" },
    ]);
  });
});

describe("FleetExerciseRecordSchema", () => {
  const decode = Schema.decodeUnknownResult(FleetExerciseRecordSchema, {
    onExcessProperty: "error",
  });
  const valid = {
    month: "1880-03",
    year: 1880,
    yearCount: 1,
    shipIds: ["a"],
    maintenanceAdderBp: 10000,
  };

  it("accepts a stored record and rejects malformed ones", () => {
    expect(Result.isSuccess(decode(valid))).toBe(true);
    for (const bad of [
      { ...valid, month: "1880-13" },
      { ...valid, yearCount: -1 },
      { ...valid, shipIds: [""] },
      { ...valid, extra: 1 },
    ]) {
      expect(Result.isFailure(decode(bad))).toBe(true);
    }
  });
});
