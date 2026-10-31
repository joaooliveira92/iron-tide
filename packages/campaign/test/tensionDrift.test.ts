import { describe, expect, it } from "vite-plus/test";
import {
  navalRatioBp,
  planTensionDrift,
  resolveTensionDriftStep,
  type TensionDriftPair,
} from "../src/tensionDrift.js";

const RULES = {
  maxRiseProbabilityBp: 150,
  navalRatio: { thresholdBp: 20_000, pressureBp: 40, tensionCeiling: 6 },
  damping: { alliedBp: 60, tradeAgreementBp: 25 },
  cooling: { alliedBp: 30, tradeAgreementBp: 15 },
};

function pair(overrides: Partial<TensionDriftPair> = {}): TensionDriftPair {
  return {
    relation: "neutral",
    tension: 5,
    frictionBp: 0,
    navalBudgetA: 100,
    navalBudgetB: 100,
    ...overrides,
  };
}

describe("navalRatioBp", () => {
  it("is the larger budget over the smaller in basis points, floored", () => {
    expect(navalRatioBp(100, 100)).toBe(10_000);
    expect(navalRatioBp(300, 100)).toBe(30_000);
    expect(navalRatioBp(100, 300)).toBe(30_000);
    expect(navalRatioBp(10, 3)).toBe(33_333);
  });

  it("treats a pair where only one side spends as unboundedly lopsided", () => {
    expect(navalRatioBp(50, 0)).toBe(Number.MAX_SAFE_INTEGER);
    expect(navalRatioBp(0, 50)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("is parity when neither side spends", () => {
    expect(navalRatioBp(0, 0)).toBe(10_000);
  });
});

describe("planTensionDrift", () => {
  it("is idle for a pair with no friction and a balanced navy", () => {
    expect(planTensionDrift(pair(), RULES)).toEqual({
      riseProbabilityBp: 0,
      coolingProbabilityBp: 0,
    });
  });

  it("never moves tension during war", () => {
    const plan = planTensionDrift(
      pair({ relation: "at_war", frictionBp: 100, navalBudgetA: 900 }),
      RULES,
    );
    expect(plan).toEqual({ riseProbabilityBp: 0, coolingProbabilityBp: 0 });
  });

  it("rises on authored pair friction and names it", () => {
    expect(planTensionDrift(pair({ frictionBp: 20 }), RULES)).toEqual({
      riseProbabilityBp: 20,
      riseReason: "PAIR_FRICTION",
      coolingProbabilityBp: 0,
    });
  });

  it("adds naval ratio pressure only at or beyond the threshold", () => {
    const below = planTensionDrift(pair({ navalBudgetA: 199, navalBudgetB: 100 }), RULES);
    const at = planTensionDrift(pair({ navalBudgetA: 200, navalBudgetB: 100 }), RULES);
    expect(below.riseProbabilityBp).toBe(0);
    expect(at).toEqual({
      riseProbabilityBp: 40,
      riseReason: "NAVAL_RATIO",
      coolingProbabilityBp: 0,
    });
  });

  it("stops naval ratio pressure at the tension ceiling", () => {
    const lopsided = { navalBudgetA: 300, navalBudgetB: 100 };
    expect(planTensionDrift(pair({ ...lopsided, tension: 5 }), RULES).riseProbabilityBp).toBe(40);
    expect(planTensionDrift(pair({ ...lopsided, tension: 6 }), RULES)).toEqual({
      riseProbabilityBp: 0,
      coolingProbabilityBp: 0,
    });
  });

  it("lets authored friction carry a pair past the ceiling without the naval pressure", () => {
    const plan = planTensionDrift(
      pair({ tension: 7, frictionBp: 20, navalBudgetA: 300, navalBudgetB: 100 }),
      RULES,
    );
    expect(plan).toEqual({
      riseProbabilityBp: 20,
      riseReason: "PAIR_FRICTION",
      coolingProbabilityBp: 0,
    });
  });

  it("credits the larger driver as the reason", () => {
    const ratioLeads = planTensionDrift(pair({ frictionBp: 10, navalBudgetA: 300 }), RULES);
    const frictionLeads = planTensionDrift(pair({ frictionBp: 90, navalBudgetA: 300 }), RULES);
    expect(ratioLeads.riseReason).toBe("NAVAL_RATIO");
    expect(frictionLeads.riseReason).toBe("PAIR_FRICTION");
    expect(frictionLeads.riseProbabilityBp).toBe(130);
  });

  it("caps the rise probability", () => {
    expect(
      planTensionDrift(pair({ frictionBp: 9_000, navalBudgetA: 900 }), RULES).riseProbabilityBp,
    ).toBe(150);
  });

  it("lets an alliance subtract from the rise", () => {
    const plan = planTensionDrift(pair({ relation: "allied", frictionBp: 100 }), RULES);
    expect(plan.riseProbabilityBp).toBe(40);
    expect(plan.coolingProbabilityBp).toBe(0);
  });

  it("lets a trade agreement subtract from the rise", () => {
    const plan = planTensionDrift(pair({ relation: "trade_agreement", frictionBp: 100 }), RULES);
    expect(plan.riseProbabilityBp).toBe(75);
  });

  it("cools an allied pair whose pressure is fully damped", () => {
    const plan = planTensionDrift(pair({ relation: "allied", frictionBp: 60 }), RULES);
    expect(plan).toEqual({
      riseProbabilityBp: 0,
      coolingProbabilityBp: 30,
      coolingReason: "ALLIANCE_COOLING",
    });
  });

  it("cools a trade-agreement pair whose pressure is fully damped", () => {
    const plan = planTensionDrift(pair({ relation: "trade_agreement" }), RULES);
    expect(plan.coolingReason).toBe("TRADE_AGREEMENT_COOLING");
    expect(plan.coolingProbabilityBp).toBe(15);
  });

  it("never cools a pair that is still rising", () => {
    const plan = planTensionDrift(pair({ relation: "allied", frictionBp: 100 }), RULES);
    expect(plan.coolingProbabilityBp).toBe(0);
  });
});

describe("resolveTensionDriftStep", () => {
  const rising = {
    riseProbabilityBp: 100,
    riseReason: "PAIR_FRICTION" as const,
    coolingProbabilityBp: 0,
  };
  const cooling = {
    riseProbabilityBp: 0,
    coolingProbabilityBp: 100,
    coolingReason: "ALLIANCE_COOLING" as const,
  };

  it("rises when the draw is below the rise probability", () => {
    expect(resolveTensionDriftStep(rising, 5, 99)).toEqual({
      delta: 1,
      reasonCode: "PAIR_FRICTION",
    });
  });

  it("holds when the draw is at the rise probability", () => {
    expect(resolveTensionDriftStep(rising, 5, 100)).toEqual({ delta: 0, reasonCode: "NO_STEP" });
  });

  it("cannot rise past 10", () => {
    expect(resolveTensionDriftStep(rising, 10, 0)).toEqual({ delta: 0, reasonCode: "AT_CEILING" });
  });

  it("cools when the draw is in the top slice of the range", () => {
    expect(resolveTensionDriftStep(cooling, 5, 9_900)).toEqual({
      delta: -1,
      reasonCode: "ALLIANCE_COOLING",
    });
    expect(resolveTensionDriftStep(cooling, 5, 9_899)).toEqual({ delta: 0, reasonCode: "NO_STEP" });
  });

  it("cannot cool below 0", () => {
    expect(resolveTensionDriftStep(cooling, 0, 9_999)).toEqual({
      delta: 0,
      reasonCode: "AT_FLOOR",
    });
  });

  it("is idle when the plan has no probability", () => {
    expect(
      resolveTensionDriftStep({ riseProbabilityBp: 0, coolingProbabilityBp: 0 }, 5, 0),
    ).toEqual({ delta: 0, reasonCode: "NO_STEP" });
  });
});
