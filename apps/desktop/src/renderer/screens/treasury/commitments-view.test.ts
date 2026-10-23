import { describe, expect, it } from "vite-plus/test";

import type { ConstructionCommitment, FleetUpkeep } from "../../../shared/budget-contract.js";
import { projectRows, projectStatusStyle, shareOf, upkeepSegments } from "./commitments-view.js";

const fleet: FleetUpkeep = {
  total: 40,
  atWar: false,
  warSurcharge: 0,
  groups: [
    { readiness: "ACTIVE", ships: 2, cost: 30, multiplierBp: 10_000 },
    { readiness: "WORKING_UP", ships: 0, cost: 0, multiplierBp: 10_000 },
    { readiness: "RESERVE", ships: 1, cost: 10, multiplierBp: 7_500 },
  ],
  ships: [],
};

const project = (over: Partial<ConstructionCommitment>): ConstructionCommitment => ({
  projectId: "p",
  className: "Ironclad",
  shipType: "Battleship",
  status: "ACTIVE",
  draw: 0,
  carryingCost: 0,
  foreign: false,
  percentComplete: 0,
  ...over,
});

describe("upkeepSegments", () => {
  it("drops empty readiness groups and shares the total by cost", () => {
    const segments = upkeepSegments(fleet);
    expect(segments.map((s) => [s.readiness, s.ships, s.shareOfUpkeep, s.multiplier])).toEqual([
      ["ACTIVE", 2, 0.75, 1],
      ["RESERVE", 1, 0.25, 0.75],
    ]);
  });

  it("has no share to give an empty fleet", () => {
    expect(upkeepSegments({ ...fleet, total: 0, groups: [] })).toEqual([]);
  });
});

describe("projectRows", () => {
  it("orders by what each project costs this month, counting halted carrying cost", () => {
    const rows = projectRows([
      project({ projectId: "a", draw: 5 }),
      project({ projectId: "b", status: "HALTED", carryingCost: 9 }),
      project({ projectId: "c", draw: 5 }),
    ]);
    expect(rows.map((r) => [r.projectId, r.monthlyCost])).toEqual([
      ["b", 9],
      ["a", 5],
      ["c", 5],
    ]);
  });

  it("falls back to the raw status for one it does not know", () => {
    expect(projectStatusStyle("HALTED").tone).toBe("bad");
    expect(projectStatusStyle("MYSTERY")).toEqual({ label: "MYSTERY", tone: "neutral" });
  });
});

describe("shareOf", () => {
  it("clamps to the unit range and never divides by zero", () => {
    expect(shareOf(1, 4)).toBe(0.25);
    expect(shareOf(9, 4)).toBe(1);
    expect(shareOf(1, 0)).toBe(0);
  });
});
