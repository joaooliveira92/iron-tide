import { fleetManagementFromRulesets } from "@bluewave/content-compiler";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign } from "../src/production-pack.js";

const bundle = compileProductionCampaign().bundle;

function productionExercise() {
  const decoded = fleetManagementFromRulesets(bundle.rulesets);
  if (decoded === undefined || !decoded.ok)
    throw new Error("production ruleset has no valid fleetManagement section");
  return decoded.value.exercise;
}

describe("1880 fleet exercise tension", () => {
  it("authors a PROVISIONAL tension consequence so the rule is not inert", () => {
    const exercise = productionExercise();
    expect(exercise.tension).toEqual({ minShips: 4, increase: 1, ceiling: 5 });
  });

  it("keeps the consequence inside the decode bounds", () => {
    const tension = productionExercise().tension;
    expect(tension).toBeDefined();
    expect(tension!.minShips).toBeGreaterThanOrEqual(1);
    expect(tension!.increase).toBeGreaterThanOrEqual(1);
    expect(tension!.increase).toBeLessThanOrEqual(5);
    expect(tension!.ceiling).toBeGreaterThanOrEqual(tension!.increase);
    expect(tension!.ceiling).toBeLessThanOrEqual(9);
  });
});
