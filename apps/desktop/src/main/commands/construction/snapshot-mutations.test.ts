import type { ConstructionPlanRecord } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { constructionProjectFor } from "./snapshot-mutations.js";

const MONTH = { year: 1880, month: 2 };
const plan = (units: number[]): ConstructionPlanRecord => ({
  yardId: "yard_small",
  packages: units.map((u, i) => ({
    id: `p${i}`,
    kind: i === 0 ? "HULL" : "LAUNCH",
    line: "slipway",
    totalWork: SafeInt(u),
    dependsOn: i === 0 ? [] : ["p0"],
  })),
  capacityUnits: { slipway: SafeInt(5) },
});

describe("constructionProjectFor with a design's construction plan", () => {
  it("starts every package with no work done, and records the yard, when the plan adds up to the cost", () => {
    const p = constructionProjectFor("cmd-1", "d1", 10, MONTH, plan([7, 3]));
    expect(p.totalWork).toBe(10);
    expect(p.completedWork).toBe(0);
    expect(p.yardId).toBe("yard_small");
    expect(p.packages).toEqual([
      { id: "p0", kind: "HULL", line: "slipway", totalWork: 7, doneWork: 0, dependsOn: [] },
      { id: "p1", kind: "LAUNCH", line: "slipway", totalWork: 3, doneWork: 0, dependsOn: ["p0"] },
    ]);
  });

  it("copies the dependency lists, so the project does not alias the design", () => {
    const source = plan([7, 3]);
    const p = constructionProjectFor("cmd-1", "d1", 10, MONTH, source);
    expect(p.packages![1]!.dependsOn).not.toBe(source.packages[1]!.dependsOn);
  });

  it("keeps the single-figure model when there is no plan, or the plan does not add up", () => {
    const none = constructionProjectFor("cmd-1", "d1", 10, MONTH);
    expect("packages" in none).toBe(false);
    expect("yardId" in none).toBe(false);
    const off = constructionProjectFor("cmd-1", "d1", 10, MONTH, plan([7, 4]));
    expect("packages" in off).toBe(false);
    expect(off.totalWork).toBe(10);
  });

  it("is unchanged for everything else: id, status and start month", () => {
    const p = constructionProjectFor("cmd-1", "d1", 10, MONTH, plan([7, 3]));
    expect(p).toMatchObject({
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "d1",
      designVersionId: "d1",
      status: "PLANNED",
      startedAt: "1880-02",
    });
  });
});
