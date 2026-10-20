import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { monthlyAbsorbable } from "../src/constructionDraw.js";
import type { ConstructionPackage, ConstructionProject } from "../src/state.js";

// ADR-0230 section 6: one draw shared by the appropriation phase, the outlook, the capacity-pressure demand and the
// dockyard readout. These tests pin that answer through its interface, not through any one caller.
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

  it("raises the draw by 10% in a paid accelerated month, after the build-time pace", () => {
    const p = project({ packages: [pkg("hull", "slipway", 100)], status: "ACCELERATED" });
    expect(monthlyAbsorbable(p, { slipway: 10 }, "1880-01")).toBe(11);
    expect(
      monthlyAbsorbable({ ...p, buildTimeMultiplierBp: 8_000 }, { slipway: 10 }, "1880-01"),
    ).toBe(13);
  });

  it("leaves a package schedule unbounded by capacity when no throughput record exists", () => {
    const p = project({
      totalWork: SafeInt(120),
      packages: [pkg("hull", "slipway", 100), pkg("launch", "slipway", 20, ["hull"])],
    });
    expect(monthlyAbsorbable(p, undefined, "1880-01")).toBe(100);
  });
});
