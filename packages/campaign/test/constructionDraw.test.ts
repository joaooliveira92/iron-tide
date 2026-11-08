import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  monthlyAbsorbable,
  monthlyAbsorbableDetail,
  paceRoomUnits,
  projectMonthsToComplete,
} from "../src/constructionDraw.js";
import type { ConstructionPackage, ConstructionProject } from "../src/state.js";
import type { AccelerationTerms } from "@bluewave/ship-design";

const TERMS: AccelerationTerms = {
  workMultiplierBp: 10_500,
  timeBp: 9_000,
  pressureWeightBp: 12_500,
  delayThresholdBp: 9_000,
  delayProbabilityCapBp: 5_000,
  poolMultipleBp: 30_000,
};

function pkg(
  id: string,
  line: ConstructionPackage["line"],
  totalWork: number,
  dependsOn: string[] = [],
): ConstructionPackage {
  return {
    id,
    kind: "HULL",
    line,
    totalWork: SafeInt(totalWork),
    doneWork: SafeInt(0),
    dependsOn,
  };
}

function project(over: Partial<ConstructionProject> = {}): ConstructionProject {
  return {
    id: "p",
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "t",
    designVersionId: "d",
    totalWork: SafeInt(100),
    completedWork: SafeInt(0),
    paidWork: SafeInt(0),
    status: "ACTIVE",
    startedAt: "1880-01",
    ...over,
  };
}

describe("monthlyAbsorbable", () => {
  it("a single-figure project absorbs its remaining work, as the executor's single-figure path does", () => {
    expect(
      monthlyAbsorbable(
        project({ completedWork: SafeInt(40) }),
        { slipway: 2, quay: 2 },
        "1880-01",
      ),
    ).toBe(60);
    expect(
      monthlyAbsorbable(project({ completedWork: SafeInt(100) }), { slipway: 2 }, "1880-01"),
    ).toBe(0);
  });

  it("a package project absorbs what each of its lines can do this month", () => {
    const p = project({
      totalWork: SafeInt(140),
      packages: [pkg("hull", "slipway", 100), pkg("machinery", "machinery", 40)],
    });
    expect(monthlyAbsorbable(p, { slipway: 10, machinery: 5 }, "1880-01")).toBe(15);
  });

  it("caps the draw at the project's remaining work", () => {
    const p = project({
      completedWork: SafeInt(90),
      packages: [pkg("hull", "slipway", 100)],
    });
    expect(monthlyAbsorbable(p, { slipway: 1_000 }, "1880-01")).toBe(10);
  });

  it("starts a dependent package only in the month after its dependency is complete", () => {
    const p = project({
      totalWork: SafeInt(120),
      packages: [pkg("hull", "slipway", 100), pkg("launch", "slipway", 20, ["hull"])],
    });
    expect(monthlyAbsorbable(p, { slipway: 1_000 }, "1880-01")).toBe(100);
    const hullDone = project({
      ...p,
      packages: [{ ...p.packages![0]!, doneWork: SafeInt(100) }, p.packages![1]!],
    });
    expect(monthlyAbsorbable(hullDone, { slipway: 1_000 }, "1880-02")).toBe(20);
  });

  it("does not offer capacity already used this month", () => {
    const p = project({
      totalWork: SafeInt(120),
      packages: [pkg("hull", "slipway", 100), pkg("launch", "slipway", 20, ["hull"])],
      monthUsage: {
        month: "1880-01",
        used: { slipway: SafeInt(100) },
        startDone: { hull: SafeInt(0), launch: SafeInt(0) },
      },
    });
    expect(monthlyAbsorbable(p, { slipway: 100 }, "1880-01")).toBe(0);
    expect(monthlyAbsorbable(p, { slipway: 100 }, "1880-02")).toBe(100);
  });

  it("paces capacity by the national build-time multiplier", () => {
    const p = project({ packages: [pkg("hull", "slipway", 100)] });
    expect(monthlyAbsorbable(p, { slipway: 10 }, "1880-01")).toBe(10);
    expect(
      monthlyAbsorbable({ ...p, buildTimeMultiplierBp: 8_000 }, { slipway: 10 }, "1880-01"),
    ).toBe(12);
    expect(
      monthlyAbsorbable({ ...p, buildTimeMultiplierBp: 12_500 }, { slipway: 10 }, "1880-01"),
    ).toBe(8);
  });

  it("raises the draw by the content work rate in an accelerated month, after the build-time pace", () => {
    const p = project({
      totalWork: SafeInt(1_000),
      packages: [pkg("hull", "slipway", 1_000)],
      status: "ACCELERATED",
    });
    expect(monthlyAbsorbable(p, { slipway: 100 }, "1880-01", TERMS)).toBe(116);
    expect(
      monthlyAbsorbable({ ...p, buildTimeMultiplierBp: 8_000 }, { slipway: 10 }, "1880-01", TERMS),
    ).toBe(14);
  });

  it("gives an accelerated project no speed-up when the content terms are absent", () => {
    const p = project({ packages: [pkg("hull", "slipway", 100)], status: "ACCELERATED" });
    expect(monthlyAbsorbable(p, { slipway: 10 }, "1880-01")).toBe(10);
  });

  it("leaves a package schedule unbounded by capacity when no throughput record exists", () => {
    const p = project({
      totalWork: SafeInt(120),
      packages: [pkg("hull", "slipway", 100), pkg("launch", "slipway", 20, ["hull"])],
    });
    expect(monthlyAbsorbable(p, undefined, "1880-01")).toBe(100);
  });
});

describe("monthlyAbsorbableDetail", () => {
  it("reports the same draw as monthlyAbsorbable, split across the lines that did the work", () => {
    const p = project({
      totalWork: SafeInt(140),
      packages: [pkg("hull", "slipway", 100), pkg("machinery", "machinery", 40)],
    });
    const detail = monthlyAbsorbableDetail(p, { slipway: 10, machinery: 5 }, "1880-01");
    expect(detail.amount).toBe(monthlyAbsorbable(p, { slipway: 10, machinery: 5 }, "1880-01"));
    expect(detail.remainingWork).toBe(140);
    expect(detail.appliedByLine.slipway).toBe(10);
    expect(detail.appliedByLine.machinery).toBe(5);
    expect(detail.appliedByLine.quay).toBe(0);
  });

  it("reports an unbounded single-figure draw with no line split", () => {
    const detail = monthlyAbsorbableDetail(
      project({ completedWork: SafeInt(40) }),
      undefined,
      "1880-01",
    );
    expect(detail.amount).toBe(60);
    expect(detail.appliedByLine.slipway).toBe(0);
  });

  it("reports no work for a completed project", () => {
    const detail = monthlyAbsorbableDetail(
      project({ completedWork: SafeInt(100) }),
      { slipway: 10 },
      "1880-01",
    );
    expect(detail.amount).toBe(0);
    expect(detail.remainingWork).toBe(0);
  });
});

describe("paced projects under acceleration", () => {
  const paced = (over: Partial<ConstructionProject> = {}): ConstructionProject =>
    project({
      totalWork: SafeInt(1_200),
      buildMonths: 12,
      packages: [pkg("hull", "slipway", 1_200)],
      ...over,
    });

  const acceleratedAtMay = (): ConstructionProject =>
    paced({
      completedWork: SafeInt(400),
      status: "ACCELERATED",
      totalWork: SafeInt(1_240),
      packages: [pkg("hull", "slipway", 1_240)],
      acceleratedFromMonth: "1880-05",
      acceleratedFromWork: SafeInt(400),
    });

  it("keeps the cumulative pace limit on an accelerated project", () => {
    expect(paceRoomUnits(paced({ status: "ACCELERATED" }), "1880-01")).toBe(100);
  });

  it("compresses the remaining schedule by the content time factor from the month it was accelerated", () => {
    const capacity = { slipway: 1_000_000 };
    const normal = paced({ completedWork: SafeInt(400) });
    expect(projectMonthsToComplete(normal, capacity, "1880-05")).toBe(8);
    expect(projectMonthsToComplete(acceleratedAtMay(), capacity, "1880-05", 1_200, TERMS)).toBe(
      Math.round(8 * 0.9),
    );
  });

  it("does not release a catch-up burst when accelerating mid-build", () => {
    expect(paceRoomUnits(acceleratedAtMay(), "1880-05", TERMS)).toBe(120);
  });
});
