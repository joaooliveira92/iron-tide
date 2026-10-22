import type { ConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import {
  LINE_IDS,
  simulateConstruction,
  type ConstructionPlan,
  type LineId,
  type WorkPackage,
} from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { fundConstructionProject } from "../src/constructionFunding.js";

const pk = (
  id: string,
  kind: WorkPackage["kind"],
  line: LineId,
  totalWork: number,
  dependsOn: string[] = [],
): WorkPackage => ({ id, kind, line, totalWork, dependsOn });
const plan: ConstructionPlan = (() => {
  const packages = [
    pk("hull", "HULL", "slipway", 100),
    pk("machinery", "MACHINERY", "machinery", 40),
    pk("armour", "ARMOUR", "armour_plate", 60),
    pk("ordnance", "ORDNANCE", "heavy_gun", 30),
    pk("launch", "LAUNCH", "slipway", 20, ["hull"]),
    pk("fit_out", "FIT_OUT", "quay", 50, ["launch", "machinery", "armour", "ordnance"]),
    pk("trials", "TRIALS", "trials", 10, ["fit_out"]),
    pk("acceptance", "ACCEPTANCE", "trials", 5, ["trials"]),
  ];
  return { packages, totalWork: packages.reduce((a, p) => a + p.totalWork, 0) };
})();
const capacity = (n: number): Record<string, number> =>
  Object.fromEntries(LINE_IDS.map((l) => [l, n]));

const projectOf = (): ConstructionProject => ({
  id: "project-1",
  type: "ship",
  projectType: "NEW_CONSTRUCTION",
  targetId: "d",
  designVersionId: "d",
  totalWork: SafeInt(plan.totalWork),
  completedWork: SafeInt(0),
  paidWork: SafeInt(0),
  status: "PLANNED",
  startedAt: "1880-01",
  packages: plan.packages.map((p) => ({
    id: p.id,
    kind: p.kind,
    line: p.line,
    totalWork: SafeInt(p.totalWork),
    doneWork: SafeInt(0),
    dependsOn: [...p.dependsOn],
  })),
});
const done = (p: ConstructionProject) =>
  Object.fromEntries(p.packages!.map((x) => [x.id, x.doneWork as number]));
const month = (n: number) => `1880-${String(n).padStart(2, "0")}`;

describe("fundConstructionProject", () => {
  it("leaves a project without packages untouched and applies nothing", () => {
    const legacy = { ...projectOf() };
    delete legacy.packages;
    expect(fundConstructionProject(legacy, capacity(1_000), 500, "1880-01")).toEqual({
      project: legacy,
      applied: 0,
    });
  });

  it("applies work to packages whose dependencies were done, limited by capacity and by funds", () => {
    const r = fundConstructionProject(projectOf(), capacity(25), 1_000, "1880-01");
    expect(done(r.project)).toMatchObject({
      hull: 25,
      machinery: 25,
      armour: 25,
      ordnance: 25,
      launch: 0,
    });
    expect(r.applied).toBe(100);
    expect(r.project.completedWork).toBe(100);
    expect(r.project.paidWork).toBe(100);
    expect(r.project.status).toBe("ACTIVE");
    const poor = fundConstructionProject(projectOf(), capacity(1_000), 50, "1880-01");
    expect(poor.applied).toBe(50);
    expect(poor.project.paidWork).toBe(50);
  });

  it("does not spend money it cannot use: capacity used up means nothing is applied or paid", () => {
    const first = fundConstructionProject(projectOf(), capacity(10), 1_000, "1880-01");
    const second = fundConstructionProject(first.project, capacity(10), 1_000, "1880-01");
    expect(second.applied).toBe(0);
    expect(second.project.paidWork).toBe(first.project.paidWork);
    expect(second.project.completedWork).toBe(first.project.completedWork);
  });

  it("a second funding call in the same month cannot reuse capacity or start a dependent early", () => {
    const first = fundConstructionProject(projectOf(), capacity(1_000), 100, "1880-01");
    expect(done(first.project)["hull"]).toBe(100);
    const second = fundConstructionProject(first.project, capacity(1_000), 1_000_000, "1880-01");
    expect(done(second.project)["launch"]).toBe(0);
    const next = fundConstructionProject(second.project, capacity(1_000), 1_000_000, "1880-02");
    expect(done(next.project)["launch"]).toBe(20);
  });

  it("completedWork is always the sum of done work, never above the total, and the input is not mutated", () => {
    const start = projectOf();
    const snapshot = JSON.stringify(start);
    let p = start;
    for (let m = 1; m <= 40; m++) {
      p = fundConstructionProject(p, capacity(30), 80, month(m)).project;
      expect(p.completedWork as number).toBe(
        p.packages!.reduce((a, x) => a + (x.doneWork as number), 0),
      );
      expect(p.completedWork as number).toBeLessThanOrEqual(p.totalWork as number);
    }
    expect(JSON.stringify(start)).toBe(snapshot);
  });

  it("unlimited capacity when the design has none recorded", () => {
    const r = fundConstructionProject(projectOf(), undefined, 1_000, "1880-01");
    expect(r.applied).toBe(100 + 40 + 60 + 30);
  });

  it("is deterministic", () => {
    const a = fundConstructionProject(projectOf(), capacity(30), 80, "1880-01");
    const b = fundConstructionProject(projectOf(), capacity(30), 80, "1880-01");
    expect(a).toEqual(b);
  });
});

describe("funding month by month reproduces the forecast simulation", () => {
  it("for several capacities and monthly funding, the same work lands in the same months", () => {
    for (const cap of [15, 40, 1_000]) {
      for (const funding of [60, 100_000]) {
        const sim = simulateConstruction(
          plan,
          {
            capacity: capacity(cap) as Record<LineId, number>,
            monthlyFundingMicro: funding,
            costPerWorkMicro: 1,
          },
          500,
        );
        let p = projectOf();
        const perMonth: Record<string, number>[] = [];
        for (let m = 1; m <= sim.durationMonths; m++) {
          const before = done(p);
          p = fundConstructionProject(
            p,
            capacity(cap),
            funding,
            month(((m - 1) % 12) + 1) + `-${m}`,
          ).project;
          const after = done(p);
          const applied: Record<string, number> = {};
          for (const id of Object.keys(after))
            if (after[id]! > before[id]!) applied[id] = after[id]! - before[id]!;
          perMonth.push(applied);
        }
        expect(p.completedWork).toBe(plan.totalWork);
        const simApplied = sim.months.map((m) =>
          Object.fromEntries(Object.entries(m.applied).filter(([, v]) => v > 0)),
        );
        expect(perMonth).toEqual(simApplied);
      }
    }
  });
});
