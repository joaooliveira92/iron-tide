import { describe, expect, it } from "vite-plus/test";
import { accelerationTermsOf, acceleratedWorkRate } from "../src/accelerationTerms.js";
import { constructionBalance, costBalance } from "./fixtures/gunboat.js";

describe("accelerationTermsOf", () => {
  const terms = accelerationTermsOf(constructionBalance, costBalance);

  it("reads the premium from the cost balance and the time factor from the construction balance", () => {
    expect(terms.workMultiplierBp).toBe(10_000 + costBalance.accelerationCostBp);
    expect(terms.timeBp).toBe(constructionBalance.accelerationTimeBp);
  });

  it("takes the pressure model and the pool multiple from the construction balance", () => {
    expect(terms.pressureWeightBp).toBe(constructionBalance.accelerationPressureWeightBp);
    expect(terms.delayThresholdBp).toBe(constructionBalance.accelerationDelayThresholdBp);
    expect(terms.delayProbabilityCapBp).toBe(constructionBalance.accelerationDelayProbabilityCapBp);
    expect(terms.poolMultipleBp).toBe(constructionBalance.accelerationPoolMultipleBp);
  });

  it("derives the work rate so premium work finishes in exactly the content time factor", () => {
    const remaining = 90_000;
    const accelerated = Math.ceil((remaining * terms.workMultiplierBp) / 10_000);
    const rate = acceleratedWorkRate(1_000, terms);
    const monthsNormal = remaining / 1_000;
    const monthsAccelerated = accelerated / rate;
    expect(monthsAccelerated / monthsNormal).toBeCloseTo(terms.timeBp / 10_000, 2);
  });

  it("floors the accelerated rate", () => {
    expect(acceleratedWorkRate(10, terms)).toBe(
      Math.floor((10 * terms.workMultiplierBp) / terms.timeBp),
    );
  });
});
