import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { readinessCommandProblems, type Ship } from "../src/index.js";

function ship(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "c",
    nationId: "uk",
    locationAreaId: "lon",
    designVersionId: "d",
    hitPoints: SafeInt(10),
    maxHitPoints: SafeInt(10),
    speed: SafeInt(1),
    firepower: SafeInt(1),
    armor: SafeInt(1),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

const nation = (ships: Ship[]) => ({ fleets: [{ ships }] });

describe("readinessCommandProblems", () => {
  it("rejects an empty batch and duplicate ships", () => {
    expect(readinessCommandProblems(nation([]), "uk", [], "RESERVE")).toEqual([
      { shipId: "", reason: "EMPTY_BATCH" },
    ]);
    expect(readinessCommandProblems(nation([ship("a")]), "uk", ["a", "a"], "RESERVE")).toEqual([
      { shipId: "a", reason: "DUPLICATE_SHIP" },
    ]);
  });

  it("lets an assigned ship return to ACTIVE only when it is not already active", () => {
    const n = nation([ship("a", { readiness: "RESERVE", stationAssignment: "FOREIGN_STATION" })]);
    expect(readinessCommandProblems(n, "uk", ["a"], "ACTIVE")).toEqual([]);
    expect(readinessCommandProblems(n, "uk", ["a"], "MOTHBALLED")).toEqual([
      { shipId: "a", reason: "ASSIGNMENT_HELD" },
    ]);
  });

  it("allows only mothballing for a ship under repair", () => {
    const n = nation([ship("a", { readiness: "REPAIR", repairMonthsRemaining: SafeInt(2) })]);
    expect(readinessCommandProblems(n, "uk", ["a"], "MOTHBALLED")).toEqual([]);
    expect(readinessCommandProblems(n, "uk", ["a"], "RESERVE")).toEqual([
      { shipId: "a", reason: "REPAIR_IN_PROGRESS" },
    ]);
  });

  it("sorts problems by ship id", () => {
    const n = nation([ship("b", { readiness: "RESERVE" }), ship("a", { readiness: "RESERVE" })]);
    expect(readinessCommandProblems(n, "uk", ["b", "a"], "RESERVE").map((p) => p.shipId)).toEqual([
      "a",
      "b",
    ]);
  });
});
