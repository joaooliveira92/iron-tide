import { describe, expect, it } from "vite-plus/test";
import {
  chooseYard,
  compileDesign,
  computeCost,
  constructionOrderPlan,
  planConstruction,
  yardDemandOf,
  type Yard,
} from "../src/index.js";
import { constructionBalance, earlyContext, shipBuildingContent } from "./helpers/earlyContext.js";
import { havock, majestic } from "./helpers/references.js";

const month = "1896-01";
const env = shipBuildingContent.environmentFor(month);
const compiledOf = (draft: typeof majestic) => compileDesign(draft, earlyContext(month));
const costOf = (draft: typeof majestic) =>
  computeCost(compiledOf(draft), draft, env.costBalance, env.costCtx);

describe("chooseYard", () => {
  it("picks the large yard for a battleship and the smallest yard for a destroyer", () => {
    for (const [draft, expected] of [
      [majestic, "yard_large"],
      [havock, "yard_small"],
    ] as const) {
      const c = compiledOf(draft);
      const plan = planConstruction(c, draft, costOf(draft), constructionBalance, true);
      const choice = chooseYard(
        plan,
        yardDemandOf(c, draft),
        env.yards,
        constructionBalance,
        c.totalKg,
        {
          industryBp: env.industryBp,
          accelerated: env.costCtx.accelerated,
        },
      );
      expect(choice.best?.yard.facility.id).toBe(expected);
      expect(choice.best!.months).toBeGreaterThanOrEqual(choice.historicalMonths);
      const least = Math.min(
        ...[...choice.monthsByYard.values()].filter((m): m is number => m !== null),
      );
      expect(choice.best!.months).toBe(least);
    }
  });
  it("has no best yard when none fits, and lists no fitting yards", () => {
    const c = compiledOf(majestic);
    const plan = planConstruction(c, majestic, costOf(majestic), constructionBalance, true);
    const none: Yard[] = [];
    const choice = chooseYard(
      plan,
      yardDemandOf(c, majestic),
      none,
      constructionBalance,
      c.totalKg,
    );
    expect(choice.best).toBeNull();
    expect(choice.fitting).toEqual([]);
  });
  it("is deterministic", () => {
    const c = compiledOf(havock);
    const plan = planConstruction(c, havock, costOf(havock), constructionBalance, true);
    const run = () =>
      chooseYard(plan, yardDemandOf(c, havock), env.yards, constructionBalance, c.totalKg);
    expect(run().best?.yard.facility.id).toBe(run().best?.yard.facility.id);
    expect([...run().monthsByYard]).toEqual([...run().monthsByYard]);
  });
});

describe("constructionOrderPlan", () => {
  const order = (draft: typeof majestic, units: number) => {
    const c = compiledOf(draft);
    return constructionOrderPlan(
      {
        compiled: c,
        draft,
        cost: costOf(draft),
        balance: constructionBalance,
        yards: env.yards,
        industryBp: env.industryBp,
        accelerated: env.costCtx.accelerated,
      },
      units,
    );
  };
  it("carries the packages scaled to exactly the order's units, the chosen yard, and capacity in the same units", () => {
    const plan = order(majestic, 125)!;
    expect(plan.packages.reduce((a, p) => a + p.totalWork, 0)).toBe(125);
    expect(plan.yardId).toBe("yard_large");
    for (const v of Object.values(plan.capacityUnits)) expect(v).toBeGreaterThanOrEqual(0);
    expect(Math.max(...Object.values(plan.capacityUnits))).toBeGreaterThan(0);
  });
  it("a destroyer's order uses the smallest yard and still sums to its units", () => {
    const plan = order(havock, 11)!;
    expect(plan.yardId).toBe("yard_small");
    expect(plan.packages.reduce((a, p) => a + p.totalWork, 0)).toBe(11);
  });
  it("is null when no yard can build the hull", () => {
    const c = compiledOf(majestic);
    const none = constructionOrderPlan(
      {
        compiled: c,
        draft: majestic,
        cost: costOf(majestic),
        balance: constructionBalance,
        yards: [],
      },
      100,
    );
    expect(none).toBeNull();
  });
  it("is deterministic", () => {
    expect(order(majestic, 125)).toEqual(order(majestic, 125));
  });
});
