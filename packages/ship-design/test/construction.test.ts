import { describe, it, expect } from "vite-plus/test";
import {
  compileDesign,
  computeCost,
  simulateConstruction,
  LINE_IDS,
  type LineId,
  type ConstructionPlan,
} from "../src/index.js";
import {
  planConstruction,
  historicalBuildMonths,
  buildTimeEraBp,
  buildTimeIsProvisional,
  checkPlan,
  ConstructionPlanError,
} from "../src/construction.js";
import { ctx, draft, costBalance, constructionBalance } from "./fixtures/gunboat.js";
import { constructionBalance as earlyConstruction } from "./helpers/earlyContext.js";

const compiled = compileDesign(draft, ctx);
const mature = { maturityBpByTech: {}, firstOfClass: false };
const cost = computeCost(compiled, draft, costBalance, mature);
const plan = planConstruction(compiled, draft, cost, constructionBalance, false);
const cap = (n: number): Record<LineId, number> =>
  Object.fromEntries(LINE_IDS.map((l) => [l, n])) as Record<LineId, number>;
const big = (p: ConstructionPlan) => Math.max(...p.packages.map((x) => x.totalWork));

describe("cost", () => {
  it("breakdown sums exactly and every part is non-negative", () => {
    expect(cost.subtotal).toBe(cost.hull + cost.armour + cost.machinery + cost.components);
    expect(cost.total).toBe(cost.subtotal + cost.overheads + cost.firstOfClassPremium);
    for (const v of Object.values(cost)) expect(v).toBeGreaterThanOrEqual(0);
    expect(cost.hull).toBeGreaterThan(0);
    expect(cost.monthlyMaintenance).toBeGreaterThan(0);
  });
  it("immature technology costs more and first-of-class adds a premium", () => {
    const green = computeCost(compiled, draft, costBalance, {
      maturityBpByTech: { tech_qf_guns: 0, tech_whitehead: 0 },
      firstOfClass: false,
    });
    expect(green.components).toBeGreaterThan(cost.components);
    const first = computeCost(compiled, draft, costBalance, { ...mature, firstOfClass: true });
    expect(first.firstOfClassPremium).toBeGreaterThan(0);
    expect(first.total).toBeGreaterThan(cost.total);
  });
  it("faster, heavier-armoured and more subdivided designs cost more", () => {
    const fast = compileDesign(
      { ...draft, machinery: { ...draft.machinery, installedKw: 5_500 } },
      ctx,
    );
    expect(
      computeCost(
        fast,
        { ...draft, machinery: { ...draft.machinery, installedKw: 5_500 } },
        costBalance,
        mature,
      ).total,
    ).toBeGreaterThan(cost.total);
    const sub = { ...draft, hull: { ...draft.hull, subdivisionGrade: 4 as const } };
    expect(computeCost(compileDesign(sub, ctx), sub, costBalance, mature).hull).toBeGreaterThan(
      cost.hull,
    );
  });
  it("fails loudly on unknown cost data", () => {
    expect(() =>
      computeCost(compiled, draft, { ...costBalance, hullCostPerTonneMicro: {} }, mature),
    ).toThrow();
  });
});

describe("plan and schedule", () => {
  it("plan has eight acyclic packages with positive work that sum to the total", () => {
    expect(plan.packages).toHaveLength(8);
    expect(() => checkPlan(plan)).not.toThrow();
    for (const p of plan.packages) expect(p.totalWork).toBeGreaterThan(0);
    expect(plan.totalWork).toBe(plan.packages.reduce((a, p) => a + p.totalWork, 0));
  });
  it("first-of-class inflates work", () => {
    expect(
      planConstruction(compiled, draft, cost, constructionBalance, true).totalWork,
    ).toBeGreaterThan(plan.totalWork);
  });
  it("cycles and dangling dependencies are rejected", () => {
    const cyc: ConstructionPlan = {
      totalWork: 2,
      packages: [
        { id: "a", kind: "HULL", line: "slipway", totalWork: 1, dependsOn: ["b"] },
        { id: "b", kind: "LAUNCH", line: "slipway", totalWork: 1, dependsOn: ["a"] },
      ],
    };
    expect(() => checkPlan(cyc)).toThrowError(ConstructionPlanError);
    try {
      checkPlan(cyc);
    } catch (e) {
      expect((e as ConstructionPlanError).code).toBe("DOCKYARD_WORK_PACKAGE_CYCLE");
    }
    expect(() =>
      checkPlan({ totalWork: 1, packages: [{ ...cyc.packages[0]!, dependsOn: ["zzz"] }] }),
    ).toThrow();
  });
  it("respects dependencies: nothing fits out before launch and the other works are done", () => {
    const s = simulateConstruction(
      plan,
      { capacity: cap(big(plan)), monthlyFundingMicro: null, costPerWorkMicro: 1 },
      120,
    );
    const doneAt = (id: string) => s.months.find((m) => m.completed.includes(id))!.month;
    expect(doneAt("hull")).toBeLessThan(doneAt("launch") + 1);
    expect(doneAt("fit_out")).toBeGreaterThan(
      Math.max(doneAt("launch"), doneAt("machinery"), doneAt("armour"), doneAt("ordnance")) - 1,
    );
    expect(doneAt("trials")).toBeGreaterThan(doneAt("fit_out") - 1);
    expect(s.durationMonths).toBe(doneAt("acceptance"));
    expect(
      s.months.find((m) => m.applied.fit_out !== undefined && m.month <= doneAt("launch")),
    ).toBeUndefined();
  });
  it("progress is never negative, never exceeds the package, and completes exactly", () => {
    const s = simulateConstruction(
      plan,
      { capacity: cap(Math.ceil(big(plan) / 7)), monthlyFundingMicro: null, costPerWorkMicro: 1 },
      120,
    );
    for (const m of s.months)
      for (const v of Object.values(m.applied)) expect(v).toBeGreaterThanOrEqual(0);
    for (const p of plan.packages) expect(s.finalWork[p.id]).toBe(p.totalWork);
  });
  it("less capacity or funding means a longer build, and the bottleneck is the throttled line", () => {
    const fast = simulateConstruction(
      plan,
      { capacity: cap(big(plan) / 2), monthlyFundingMicro: null, costPerWorkMicro: 1 },
      600,
    );
    const slow = simulateConstruction(
      plan,
      {
        capacity: {
          ...cap(big(plan) / 2),
          heavy_gun: Math.ceil(plan.packages.find((p) => p.id === "ordnance")!.totalWork / 20),
        },
        monthlyFundingMicro: null,
        costPerWorkMicro: 1,
      },
      600,
    );
    expect(slow.durationMonths).toBeGreaterThan(fast.durationMonths);
    expect(slow.bottleneck).toBe("heavy_gun");
    const poor = simulateConstruction(
      plan,
      {
        capacity: cap(big(plan)),
        monthlyFundingMicro: Math.ceil(plan.totalWork / 10),
        costPerWorkMicro: 1,
      },
      600,
    );
    expect(poor.durationMonths).toBeGreaterThanOrEqual(10);
    expect(poor.durationMonths).toBeGreaterThan(fast.durationMonths);
  });
  it("a line with no capacity or funding stalls with a typed error", () => {
    expect(() =>
      simulateConstruction(
        plan,
        {
          capacity: { ...cap(1_000_000_000), slipway: 0 },
          monthlyFundingMicro: null,
          costPerWorkMicro: 1,
        },
        24,
      ),
    ).toThrowError(ConstructionPlanError);
    expect(() =>
      simulateConstruction(
        plan,
        { capacity: cap(1_000_000_000), monthlyFundingMicro: 0, costPerWorkMicro: 1 },
        24,
      ),
    ).toThrowError(ConstructionPlanError);
  });
  it("is deterministic", () => {
    const a = JSON.stringify(
      simulateConstruction(
        plan,
        { capacity: cap(big(plan) / 3), monthlyFundingMicro: null, costPerWorkMicro: 1 },
        600,
      ),
    );
    expect(
      JSON.stringify(
        simulateConstruction(
          plan,
          { capacity: cap(big(plan) / 3), monthlyFundingMicro: null, costPerWorkMicro: 1 },
          600,
        ),
      ),
    ).toBe(a);
  });
});

describe("historical build time by displacement (ADR-0067 section 5)", () => {
  const kg = (t: number) => t * 1000;
  it("hits the table points exactly and clamps outside the table", () => {
    const months = (t: number) => historicalBuildMonths(kg(t), earlyConstruction);
    expect(months(330)).toBe(18);
    expect(months(390)).toBe(18);
    expect(months(11_000)).toBe(30);
    expect(months(12_950)).toBe(35);
    expect(months(12_000)).toBe(31);
    expect(months(14_900)).toBe(36);
    expect(months(1)).toBe(18);
    expect(months(100_000)).toBe(36);
  });
  it("interpolates monotonically by displacement within an era (boundary: just either side of a point)", () => {
    for (const month of [undefined, "1880-01", "1890-06", "1897-01", "1906-01", "1910-01"]) {
      let prev = 0;
      for (let t = 300; t <= 25_000; t += 250) {
        const m = historicalBuildMonths(kg(t), earlyConstruction, { month });
        expect(m).toBeGreaterThanOrEqual(prev);
        prev = m;
      }
    }
    let prev = 0;
    for (let t = 300; t <= 14_900; t += 250) {
      const m = historicalBuildMonths(kg(t), earlyConstruction);
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
    expect(historicalBuildMonths(kg(12_949), earlyConstruction)).toBe(34);
    expect(historicalBuildMonths(kg(12_951), earlyConstruction)).toBe(35);
  });
  it("applies the industry modifier and acceleration with explicit rounding", () => {
    const eff = earlyConstruction.efficientIndustryBp;
    expect(historicalBuildMonths(kg(14_900), earlyConstruction, { industryBp: eff })).toBe(24);
    expect(historicalBuildMonths(kg(14_900), earlyConstruction, { industryBp: 13_000 })).toBe(47);
    expect(historicalBuildMonths(kg(14_900), earlyConstruction, { accelerated: true })).toBe(32);
    expect(historicalBuildMonths(kg(300), constructionBalance, { industryBp: 1 })).toBe(1);
  });
  it("scales by the era of the keel-laying month, reproducing the sourced classes", () => {
    const at = (t: number, month: string) =>
      historicalBuildMonths(kg(t), earlyConstruction, { month });
    expect(at(16_500, "1905-03")).toBe(34);
    expect(at(18_600, "1908-12")).toBe(28);
    expect(at(14_150, "1890-01")).toBe(43);
    expect(at(11_940, "1886-01")).toBe(54);
    expect(at(14_900, "1897-01")).toBe(36);
    expect(at(18_600, "1880-01")).toBe(at(18_600, "1886-06"));
    expect(at(18_600, "1880-01")).toBeGreaterThan(at(18_600, "1910-01"));
    expect(at(18_600, "1920-01")).toBe(at(18_600, "1908-01"));
    let prev = Infinity;
    for (let y = 1880; y <= 1912; y++) {
      const m = at(14_900, `${y}-01`);
      expect(m).toBeLessThanOrEqual(prev);
      prev = m;
    }
    expect(historicalBuildMonths(kg(14_900), earlyConstruction)).toBe(36);
  });
  it("rejects a malformed month instead of guessing an era", () => {
    for (const month of ["1890", "1890-13", "90-01", ""])
      expect(() => buildTimeEraBp(month, earlyConstruction)).toThrow(/YYYY-MM/);
    expect(buildTimeEraBp("1897-06", earlyConstruction)).toBe(10_000);
  });
  it("every table point carries a source and none is an unsourced ESTIMATE (ticket 22)", () => {
    expect(earlyConstruction.buildMonthsProvenance).toHaveLength(
      earlyConstruction.buildMonthsByDisplacementT.points.length,
    );
    for (const p of earlyConstruction.buildMonthsProvenance) {
      expect(p.status).toBe("VERIFIED");
      expect(p.source.length).toBeGreaterThan(20);
    }
    const low = earlyConstruction.buildMonthsByDisplacementT.points[0]![0];
    expect(low).toBe(330);
    expect(earlyConstruction.buildMonthsProvenance[0]!.source).toContain("330 t");
    const cressy = earlyConstruction.buildMonthsByDisplacementT.points.findIndex(
      ([t]) => t === 12_000,
    );
    expect(earlyConstruction.buildMonthsProvenance[cressy]!.status).toBe("VERIFIED");
    expect(earlyConstruction.buildMonthsProvenance[cressy]!.source).toContain("May 1901");
  });
  it("is provisional while a bracketing point is not VERIFIED (exact hit, between, clamped)", () => {
    const pts = earlyConstruction.buildMonthsByDisplacementT.points;
    expect(earlyConstruction.buildMonthsProvenance.every((p) => p.status === "VERIFIED")).toBe(
      true,
    );
    expect(buildTimeIsProvisional(1_000, earlyConstruction)).toBe(false);
    expect(buildTimeIsProvisional(12_500_000, earlyConstruction)).toBe(false);
    expect(buildTimeIsProvisional(90_000_000, earlyConstruction)).toBe(false);
    const sec = 2;
    const demoted = {
      ...earlyConstruction,
      buildMonthsProvenance: earlyConstruction.buildMonthsProvenance.map((p, i) =>
        i === sec ? { ...p, status: "SECONDARY" as const } : p,
      ),
    };
    const t = (i: number) => pts[i]![0] * 1000;
    expect(buildTimeIsProvisional(t(sec), demoted)).toBe(true);
    expect(buildTimeIsProvisional(t(sec) - 1000, demoted)).toBe(true);
    expect(buildTimeIsProvisional(t(sec) + 1000, demoted)).toBe(true);
    expect(buildTimeIsProvisional(12_500_000, demoted)).toBe(false);
  });
  it("is provisional while the era points bracketing the month are not VERIFIED", () => {
    const verifiedHull = 12_500_000;
    expect(buildTimeIsProvisional(verifiedHull, earlyConstruction, "1897-01")).toBe(false);
    expect(buildTimeIsProvisional(verifiedHull, earlyConstruction, "1906-01")).toBe(false);
    expect(buildTimeIsProvisional(verifiedHull, earlyConstruction, "1880-01")).toBe(false);
    expect(buildTimeIsProvisional(verifiedHull, earlyConstruction, "1888-01")).toBe(true);
    expect(buildTimeIsProvisional(verifiedHull, earlyConstruction, "1892-01")).toBe(true);
    expect(() =>
      buildTimeIsProvisional(verifiedHull, { ...earlyConstruction, buildTimeEraProvenance: [] }),
    ).toThrow(/buildTimeEraProvenance/);
  });
  it("rejects provenance that does not match the table", () => {
    expect(() =>
      buildTimeIsProvisional(12_000_000, { ...earlyConstruction, buildMonthsProvenance: [] }),
    ).toThrow(/Provenance/);
    const bad = earlyConstruction.buildMonthsProvenance.map((p) => ({ ...p, source: " " }));
    expect(() =>
      buildTimeIsProvisional(12_000_000, { ...earlyConstruction, buildMonthsProvenance: bad }),
    ).toThrow(/source/);
  });
  it("is deterministic across calls", () => {
    const a = historicalBuildMonths(kg(13_333), earlyConstruction, { accelerated: true });
    expect(historicalBuildMonths(kg(13_333), earlyConstruction, { accelerated: true })).toBe(a);
  });
  it("accelerated construction costs 5 % more on subtotal plus overheads", () => {
    const base = computeCost(compiled, draft, costBalance, mature);
    const fast = computeCost(compiled, draft, costBalance, { ...mature, accelerated: true });
    expect(fast.accelerationPremium).toBe(
      Math.round((base.subtotal + base.overheads) * 0.05) as typeof fast.accelerationPremium,
    );
    expect(fast.total).toBe(base.total + fast.accelerationPremium);
    expect(base.accelerationPremium).toBe(0);
  });
});
