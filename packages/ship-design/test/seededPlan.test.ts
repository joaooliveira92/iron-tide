import { describe, expect, it } from "vite-plus/test";
import { historicalBuildMonths, seededConstructionPlan } from "../src/index.js";
import { constructionBalance } from "./helpers/earlyContext.js";

const input = {
  displacementKg: 11_880_000,
  totalUnits: 100,
  completedUnits: 60,
  balance: constructionBalance,
  month: "1880-01",
};

describe("seededConstructionPlan", () => {
  it("splits the authored size into the hull-to-acceptance chain without losing a unit", () => {
    const plan = seededConstructionPlan(input);
    expect(plan.packages.map((p) => p.id)).toEqual([
      "hull",
      "launch",
      "fit_out",
      "trials",
      "acceptance",
    ]);
    expect(plan.packages.reduce((a, p) => a + p.totalWork, 0)).toBe(100);
    expect(plan.packages.reduce((a, p) => a + p.doneWork, 0)).toBe(60);
    for (const p of plan.packages) expect(p.doneWork).toBeLessThanOrEqual(p.totalWork);
  });

  it("fills the chain in dependency order", () => {
    const plan = seededConstructionPlan({ ...input, completedUnits: 90 });
    const firstOpen = plan.packages.findIndex((p) => p.doneWork < p.totalWork);
    expect(firstOpen).toBeGreaterThan(0);
    for (const p of plan.packages.slice(firstOpen + 1)) expect(p.doneWork).toBe(0);
  });

  it("paces every used line at the historical build time", () => {
    const plan = seededConstructionPlan(input);
    const months = historicalBuildMonths(input.displacementKg, constructionBalance, {
      month: input.month,
    });
    const perMonth = Math.ceil(100 / months);
    expect(plan.capacityUnits.slipway).toBe(perMonth);
    expect(plan.capacityUnits.quay).toBe(perMonth);
    expect(plan.capacityUnits.trials).toBe(perMonth);
    expect(plan.capacityUnits.armour_plate).toBe(0);
  });

  it("is deterministic and rejects a non-positive size", () => {
    expect(seededConstructionPlan(input)).toEqual(seededConstructionPlan(input));
    expect(() => seededConstructionPlan({ ...input, totalUnits: 0 })).toThrow(RangeError);
  });

  it("a bigger hull is built more slowly", () => {
    const small = seededConstructionPlan({ ...input, displacementKg: 2_000_000 });
    const large = seededConstructionPlan({ ...input, displacementKg: 14_000_000 });
    expect(large.capacityUnits.slipway).toBeLessThanOrEqual(small.capacityUnits.slipway);
  });
});
