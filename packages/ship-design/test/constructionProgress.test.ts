import { describe, expect, it } from "vite-plus/test";
import {
  advanceConstructionMonth,
  buildProgressOf,
  emptyProgress,
  isConstructionComplete,
  isPackageComplete,
  LINE_IDS,
  capacityInUnits,
  progressFromSingleFigure,
  scalePlanToUnits,
  simulateConstruction,
  totalDone,
  type ConstructionPlan,
  type LineId,
  type PackageProgress,
  type WorkPackage,
} from "../src/index.js";

const pk = (
  id: string,
  kind: WorkPackage["kind"],
  line: LineId,
  totalWork: number,
  dependsOn: string[] = [],
): WorkPackage => ({ id, kind, line, totalWork, dependsOn });
/** A small plan with the real package shape and dependencies. */
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
const capacity = (n: number): Record<LineId, number> =>
  Object.fromEntries(LINE_IDS.map((l) => [l, n])) as Record<LineId, number>;

const runSteps = (cap: Record<LineId, number>, funds: number | null, max = 200) => {
  let progress = emptyProgress(plan);
  const months: Record<string, number>[] = [];
  for (let m = 0; m < max && !isConstructionComplete(plan, progress); m++) {
    const step = advanceConstructionMonth(plan, progress, cap, funds);
    months.push({ ...step.applied });
    progress = step.progress;
  }
  return { progress, months };
};

describe("advanceConstructionMonth", () => {
  it("applies work only to packages whose dependencies are complete", () => {
    const m1 = advanceConstructionMonth(plan, emptyProgress(plan), capacity(1_000), null);
    expect(m1.applied).toEqual({ hull: 100, machinery: 40, armour: 60, ordnance: 30 });
    expect([...m1.completed].sort()).toEqual(["armour", "hull", "machinery", "ordnance"]);
    // Launch could not start in the same month hull finished: dependencies are read at the month's start.
    expect(m1.progress["launch"]).toBe(0);
  });

  it("is limited by line capacity and by funds, never exceeding remaining work", () => {
    const capped = advanceConstructionMonth(plan, emptyProgress(plan), capacity(25), null);
    expect(capped.applied).toEqual({ hull: 25, machinery: 25, armour: 25, ordnance: 25 });
    expect([...capped.limitedLines].sort()).toEqual([
      "armour_plate",
      "heavy_gun",
      "machinery",
      "slipway",
    ]);
    const poor = advanceConstructionMonth(plan, emptyProgress(plan), capacity(1_000), 50);
    expect(Object.values(poor.applied).reduce((a, b) => a + b, 0)).toBe(50);
    expect(poor.applied["hull"]).toBe(50); // contended funds go to packages in canonical order
    for (const p of plan.packages) expect(poor.progress[p.id]!).toBeLessThanOrEqual(p.totalWork);
  });

  it("does not mutate its input, and zero funds changes nothing", () => {
    const start = emptyProgress(plan);
    const snap = JSON.stringify(start);
    const idle = advanceConstructionMonth(plan, start, capacity(1_000), 0);
    expect(JSON.stringify(start)).toBe(snap);
    expect(idle.applied).toEqual({ hull: 0, machinery: 0, armour: 0, ordnance: 0 });
    expect(idle.completed).toEqual([]);
  });

  it("is deterministic", () => {
    const a = advanceConstructionMonth(plan, emptyProgress(plan), capacity(30), 80);
    const b = advanceConstructionMonth(plan, emptyProgress(plan), capacity(30), 80);
    expect(a).toEqual(b);
  });
});

describe("funding one month in several steps", () => {
  it("with the month-start progress as the dependency state, two half-funded steps equal one whole step", () => {
    const start = emptyProgress(plan);
    const whole = advanceConstructionMonth(plan, start, capacity(1_000), null);
    // Month 1: the first call finishes the hull; the second must not start launch (it depends on hull).
    const first = advanceConstructionMonth(plan, start, capacity(1_000), 100, start);
    const second = advanceConstructionMonth(plan, first.progress, capacity(1_000), null, start);
    expect(second.progress["launch"]).toBe(0);
    expect(second.progress).toEqual(whole.progress);
  });
  it("without it, a package finished by an earlier step lets its dependents start in the same month", () => {
    const start = emptyProgress(plan);
    const first = advanceConstructionMonth(plan, start, capacity(1_000), 100);
    const second = advanceConstructionMonth(plan, first.progress, capacity(1_000), null);
    expect(second.progress["launch"]).toBeGreaterThan(0);
  });
});

describe("stepping equals simulating", () => {
  it("repeated steps reproduce simulateConstruction month for month, for several capacities and funding", () => {
    for (const cap of [15, 40, 1_000]) {
      for (const monthlyFundingMicro of [null, 60]) {
        const sim = simulateConstruction(
          plan,
          { capacity: capacity(cap), monthlyFundingMicro, costPerWorkMicro: 1 },
          500,
        );
        const stepped = runSteps(capacity(cap), monthlyFundingMicro);
        expect(stepped.months.length).toBe(sim.durationMonths);
        expect(stepped.months).toEqual(sim.months.map((m) => ({ ...m.applied })));
        expect(stepped.progress).toEqual(sim.finalWork);
      }
    }
  });

  it("is resumable: stopping mid-way and continuing gives the same end state", () => {
    const first = advanceConstructionMonth(plan, emptyProgress(plan), capacity(20), null);
    const second = advanceConstructionMonth(plan, first.progress, capacity(20), null);
    const direct = runSteps(capacity(20), null);
    let progress: PackageProgress = second.progress;
    while (!isConstructionComplete(plan, progress))
      progress = advanceConstructionMonth(plan, progress, capacity(20), null).progress;
    expect(progress).toEqual(direct.progress);
  });
});

describe("buildProgressOf", () => {
  it("reads hull progress, started packages and launch from real state", () => {
    const empty = buildProgressOf(plan, emptyProgress(plan));
    expect(empty).toEqual({
      hullDoneWork: 0,
      hullTotalWork: 100,
      armourStarted: false,
      machineryStarted: false,
      launched: false,
      affectedDoneWork: 0,
    });
    const mid = buildProgressOf(plan, { ...emptyProgress(plan), hull: 100, launch: 5, armour: 1 });
    expect(mid).toMatchObject({
      hullDoneWork: 100,
      armourStarted: true,
      machineryStarted: false,
      launched: false,
    });
    expect(mid.affectedDoneWork).toBe(106);
    expect(buildProgressOf(plan, { ...emptyProgress(plan), hull: 100, launch: 20 }).launched).toBe(
      true,
    );
  });
});

describe("progressFromSingleFigure (saves made before per-package progress)", () => {
  it("is empty at zero and complete at the total", () => {
    expect(totalDone(plan, progressFromSingleFigure(plan, 0, 1_000))).toBe(0);
    const full = progressFromSingleFigure(plan, 1_000, 1_000);
    expect(isConstructionComplete(plan, full)).toBe(true);
    expect(totalDone(plan, full)).toBe(plan.totalWork);
  });
  it("pours work into the hull first, so a partly built ship reads as hull work only", () => {
    const part = progressFromSingleFigure(plan, 250, 1_000); // 25% of 315 = 78
    expect(part["hull"]).toBe(78);
    expect(part["machinery"]).toBe(0);
    const bp = buildProgressOf(plan, part);
    expect(bp).toMatchObject({ armourStarted: false, machineryStarted: false, launched: false });
  });
  it("conserves the scaled total, never exceeds a package, and ignores nonsense", () => {
    const p = progressFromSingleFigure(plan, 600, 1_000);
    for (const pkg of plan.packages) expect(p[pkg.id]!).toBeLessThanOrEqual(pkg.totalWork);
    expect(totalDone(plan, p)).toBe(Math.floor((plan.totalWork * 600) / 1_000));
    expect(totalDone(plan, progressFromSingleFigure(plan, -5, 1_000))).toBe(0);
    expect(totalDone(plan, progressFromSingleFigure(plan, 5, 0))).toBe(0);
    expect(isConstructionComplete(plan, progressFromSingleFigure(plan, 5_000, 1_000))).toBe(true);
  });
});

describe("scalePlanToUnits", () => {
  const sum = (p: ConstructionPlan) => p.packages.reduce((a, x) => a + x.totalWork, 0);
  it("makes the packages sum to exactly the requested units, in proportion", () => {
    for (const units of [1, 7, 8, 11, 100, 1_000, 123_457]) {
      const scaled = scalePlanToUnits(plan, units);
      expect(sum(scaled)).toBe(units);
      expect(scaled.totalWork).toBe(units);
    }
    const big = scalePlanToUnits(plan, plan.totalWork * 10);
    for (const p of plan.packages)
      expect(big.packages.find((x) => x.id === p.id)!.totalWork).toBe(p.totalWork * 10);
  });
  it("keeps ids, kinds, lines and dependencies, and never goes negative", () => {
    const scaled = scalePlanToUnits(plan, 5);
    expect(scaled.packages.map((p) => [p.id, p.kind, p.line, p.dependsOn])).toEqual(
      plan.packages.map((p) => [p.id, p.kind, p.line, p.dependsOn]),
    );
    for (const p of scaled.packages) expect(p.totalWork).toBeGreaterThanOrEqual(0);
  });
  it("gives the extra units to the largest remainders, ties by id, deterministically", () => {
    const a = scalePlanToUnits(plan, 13);
    expect(scalePlanToUnits(plan, 13)).toEqual(a);
    const even: ConstructionPlan = {
      packages: [pk("b", "HULL", "slipway", 1), pk("a", "MACHINERY", "machinery", 1)],
      totalWork: 2,
    };
    // 3 units over two equal packages: the extra unit goes to "a" (tie broken by id).
    expect(scalePlanToUnits(even, 3).packages.map((p) => [p.id, p.totalWork])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });
  it("a ship too small for every package leaves some at zero, which are complete from the start", () => {
    const tiny = scalePlanToUnits(plan, 3);
    expect(tiny.packages.some((p) => p.totalWork === 0)).toBe(true);
    const month = advanceConstructionMonth(tiny, emptyProgress(tiny), capacity(1_000), null);
    expect(month.progress["hull"]).toBe(tiny.packages.find((p) => p.id === "hull")!.totalWork);
  });
  it("rejects nonsense", () => {
    expect(() => scalePlanToUnits(plan, -1)).toThrow(RangeError);
    expect(() => scalePlanToUnits(plan, 1.5)).toThrow(RangeError);
    expect(() => scalePlanToUnits({ packages: [], totalWork: 0 }, 5)).toThrow(RangeError);
  });
});

describe("capacityInUnits", () => {
  const micro = { ...capacity(0), slipway: 1_000, quay: 31, trials: 0 } as Record<LineId, number>;
  it("scales with the same ratio as the plan, at least 1 for a line that has capacity", () => {
    const units = capacityInUnits(micro, plan, plan.totalWork); // ratio 1
    expect(units.slipway).toBe(1_000);
    expect(units.quay).toBe(31);
    expect(units.trials).toBe(0);
    const small = capacityInUnits(micro, plan, 3);
    expect(small.quay).toBe(1); // floor(31 * 3 / 315) = 0, raised to 1
    expect(small.trials).toBe(0);
    expect(small.armour_plate).toBe(0);
  });
  it("rejects a plan with no work", () => {
    expect(() => capacityInUnits(micro, { packages: [], totalWork: 0 }, 5)).toThrow(RangeError);
  });
});

describe("packages with no work (a very small ship)", () => {
  // Scaled to 3 units, "launch" and others round to zero.
  const tiny = scalePlanToUnits(plan, 3);
  const workOf = (id: string) => tiny.packages.find((p) => p.id === id)!.totalWork;

  it("a package with no work is complete only once its dependencies are", () => {
    expect(workOf("launch")).toBe(0);
    const start = emptyProgress(tiny);
    expect(isPackageComplete(tiny, start, "launch")).toBe(false); // hull not built yet
    const hullDone = { ...start, hull: workOf("hull") };
    expect(isPackageComplete(tiny, hullDone, "launch")).toBe(true);
  });

  it("dependents of a zero-work package wait for its dependencies, not for nothing", () => {
    const month = advanceConstructionMonth(tiny, emptyProgress(tiny), capacity(1_000), null);
    // The hull may be finished this month, but fit-out (after launch, after hull) cannot start in the same month.
    expect(month.progress["fit_out"]).toBe(0);
    let progress: PackageProgress = month.progress;
    let months = 1;
    while (!isConstructionComplete(tiny, progress) && months < 50) {
      progress = advanceConstructionMonth(tiny, progress, capacity(1_000), null).progress;
      months++;
    }
    expect(isConstructionComplete(tiny, progress)).toBe(true);
  });

  it("launched is false until the hull is built, even when the launch package has no work", () => {
    expect(buildProgressOf(tiny, emptyProgress(tiny)).launched).toBe(false);
    const built = buildProgressOf(tiny, { ...emptyProgress(tiny), hull: workOf("hull") });
    expect(built.launched).toBe(true);
  });

  it("an empty plan is complete, and an unknown id is not", () => {
    expect(isConstructionComplete({ packages: [], totalWork: 0 }, {})).toBe(true);
    expect(isPackageComplete(plan, emptyProgress(plan), "nope")).toBe(false);
  });
});
