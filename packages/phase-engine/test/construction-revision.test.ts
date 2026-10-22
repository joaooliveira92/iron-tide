import type { ConstructionPlanRecord, ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { projectBuildProgress, revisePackages } from "../src/constructionRevision.js";

type Kind =
  | "HULL"
  | "MACHINERY"
  | "ARMOUR"
  | "ORDNANCE"
  | "LAUNCH"
  | "FIT_OUT"
  | "TRIALS"
  | "ACCEPTANCE";
const SHAPE: [string, Kind, string, string[]][] = [
  ["hull", "HULL", "slipway", []],
  ["machinery", "MACHINERY", "machinery", []],
  ["armour", "ARMOUR", "armour_plate", []],
  ["ordnance", "ORDNANCE", "heavy_gun", []],
  ["launch", "LAUNCH", "slipway", ["hull"]],
  ["fit_out", "FIT_OUT", "quay", ["launch", "machinery", "armour", "ordnance"]],
  ["trials", "TRIALS", "trials", ["fit_out"]],
  ["acceptance", "ACCEPTANCE", "trials", ["trials"]],
];
const totals = (scale: number) => [100, 40, 60, 30, 20, 50, 10, 5].map((n) => n * scale);

const planOf = (scale: number): ConstructionPlanRecord => ({
  yardId: scale === 1 ? "yard_small" : "yard_large",
  packages: SHAPE.map(([id, kind, line, dependsOn], i) => ({
    id,
    kind,
    line,
    totalWork: SafeInt(totals(scale)[i]!),
    dependsOn,
  })),
  capacityUnits: { slipway: SafeInt(10) },
});
const projectOf = (done: Record<string, number> = {}): ConstructionProject => {
  const t = totals(1);
  const packages = SHAPE.map(([id, kind, line, dependsOn], i) => ({
    id,
    kind,
    line,
    totalWork: SafeInt(t[i]!),
    doneWork: SafeInt(done[id] ?? 0),
    dependsOn: [...dependsOn],
  }));
  return {
    id: "p",
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: "t",
    designVersionId: "d",
    totalWork: SafeInt(t.reduce((a, b) => a + b, 0)),
    completedWork: SafeInt(Object.values(done).reduce((a, b) => a + b, 0)),
    paidWork: SafeInt(0),
    status: "ACTIVE",
    startedAt: "1880-01",
    packages,
    yardId: "yard_small",
  };
};
const done = (r: { packages: { id: string; doneWork: number }[] }) =>
  Object.fromEntries(r.packages.map((p) => [p.id, p.doneWork as number]));
const total = (r: { packages: { id: string; totalWork: number }[] }) =>
  Object.fromEntries(r.packages.map((p) => [p.id, p.totalWork as number]));

describe("projectBuildProgress", () => {
  it("is undefined for a project with one figure", () => {
    const { packages: _p, ...single } = projectOf();
    expect(projectBuildProgress(single as ConstructionProject)).toBeUndefined();
  });
  it("reads real state: hull share, started armour and machinery, launch", () => {
    expect(projectBuildProgress(projectOf({ hull: 50 }))).toMatchObject({
      hullDoneWork: 50,
      hullTotalWork: 100,
      armourStarted: false,
      machineryStarted: false,
      launched: false,
    });
    expect(
      projectBuildProgress(projectOf({ hull: 100, armour: 1, machinery: 3, launch: 20 })),
    ).toMatchObject({
      armourStarted: true,
      machineryStarted: true,
      launched: true,
    });
  });
});

describe("revisePackages", () => {
  const free = { tier: "T0_FREE" as const, reworkWorkMicro: 0, hullDoneWorkAfter: 0 };

  it("returns null without a plan on the new design, or without packages on the project", () => {
    expect(revisePackages(projectOf(), undefined, free, ["FITTINGS"])).toBeNull();
    const { packages: _p, ...single } = projectOf();
    expect(revisePackages(single as ConstructionProject, planOf(1), free, ["FITTINGS"])).toBeNull();
  });

  it("T0 keeps the share done in every package when the design grows, and takes the new yard", () => {
    const r = revisePackages(projectOf({ hull: 50, machinery: 20 }), planOf(2), free, [
      "FITTINGS",
    ])!;
    expect(done(r)).toMatchObject({ hull: 100, machinery: 40, armour: 0 });
    expect(r.yardId).toBe("yard_large");
    expect(r.totalWork).toBe(totals(2).reduce((a, b) => a + b, 0));
    expect(r.completedWork).toBe(140);
  });

  it("keeps the invariants: totals add up, done adds up, nothing exceeds its package", () => {
    for (const scale of [1, 2]) {
      for (const tier of ["T0_FREE", "T1_REVISION", "T2_REDESIGN"] as const) {
        const r = revisePackages(
          projectOf({ hull: 60, machinery: 40, armour: 10 }),
          planOf(scale),
          { tier, reworkWorkMicro: tier === "T1_REVISION" ? 9 : 0, hullDoneWorkAfter: 30 },
          ["STRUCTURE", "FITTINGS"],
        )!;
        expect(r.packages.reduce((a, p) => a + (p.totalWork as number), 0)).toBe(r.totalWork);
        expect(r.packages.reduce((a, p) => a + (p.doneWork as number), 0)).toBe(r.completedWork);
        for (const p of r.packages)
          expect(p.doneWork as number).toBeLessThanOrEqual(p.totalWork as number);
      }
    }
  });

  it("T1 adds the rework to the package its change reworks, so remaining work grows by exactly the rework", () => {
    const before = projectOf({ hull: 50, armour: 30 });
    const r = revisePackages(
      before,
      planOf(1),
      { tier: "T1_REVISION", reworkWorkMicro: 12, hullDoneWorkAfter: 0 },
      ["FITTINGS", "ARMOUR"],
    )!;
    expect(total(r)["armour"]).toBe(60 + 12);
    expect(total(r)["fit_out"]).toBe(50);
    expect(r.totalWork - r.completedWork).toBe(
      (before.totalWork as number) - (before.completedWork as number) + 12,
    );
    expect(done(r)).toMatchObject({ hull: 50, armour: 30 });
  });

  it("T2 keeps only hull work, up to what the rules keep; everything else starts again", () => {
    const r = revisePackages(
      projectOf({ hull: 80, machinery: 40, armour: 30 }),
      planOf(1),
      { tier: "T2_REDESIGN", reworkWorkMicro: 0, hullDoneWorkAfter: 40 },
      ["STRUCTURE"],
    )!;
    expect(done(r)).toMatchObject({ hull: 40, machinery: 0, armour: 0, ordnance: 0 });
    expect(r.completedWork).toBe(40);
  });

  it("carries this month's capacity use, with the starting progress rescaled and never above the work done", () => {
    const base = projectOf({ hull: 60 });
    const withUsage: ConstructionProject = {
      ...base,
      monthUsage: {
        month: "1880-02",
        used: { slipway: SafeInt(60) },
        startDone: { hull: SafeInt(40), machinery: SafeInt(0) },
      },
    };
    const r = revisePackages(withUsage, planOf(2), free, ["FITTINGS"])!;
    expect(r.monthUsage!.month).toBe("1880-02");
    expect(r.monthUsage!.used["slipway"]).toBe(60);
    expect(r.monthUsage!.startDone["hull"]).toBe(80);
    expect(r.monthUsage!.startDone["hull"] as number).toBeLessThanOrEqual(done(r)["hull"]!);
    expect(revisePackages(base, planOf(1), free, ["FITTINGS"])!.monthUsage).toBeUndefined();
  });

  it("is deterministic and does not mutate the project", () => {
    const p = projectOf({ hull: 33, armour: 7 });
    const snapshot = JSON.stringify(p);
    const a = revisePackages(
      p,
      planOf(2),
      { tier: "T1_REVISION", reworkWorkMicro: 5, hullDoneWorkAfter: 0 },
      ["MACHINERY"],
    );
    const b = revisePackages(
      p,
      planOf(2),
      { tier: "T1_REVISION", reworkWorkMicro: 5, hullDoneWorkAfter: 0 },
      ["MACHINERY"],
    );
    expect(a).toEqual(b);
    expect(JSON.stringify(p)).toBe(snapshot);
  });
});
