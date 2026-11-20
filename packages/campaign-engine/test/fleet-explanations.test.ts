import { describe, expect, it } from "vite-plus/test";
import {
  explainTradeAssigned,
  explainTradeQuota,
  explainTradeShortfall,
} from "../src/fleet-trade.js";
import {
  explainExerciseGain,
  explainExerciseTension,
  explainServiceExperience,
  explainTrainingMaintenanceAdder,
  explainTrainingProgress,
} from "../src/fleet-explanations.js";

describe("fleet explanations", () => {
  it("explains a training maintenance adder from the base subject and the nation adjustment", () => {
    const tree = explainTrainingMaintenanceAdder({
      baseAdderBp: 3_000,
      nationMultiplierBp: 8_000,
      adderBp: 2_400,
    });
    expect(tree.formulaId).toBe("fleet_training_adder");
    expect(Number(tree.result)).toBe(2_400);
    expect(tree.children?.map((child) => [child.formulaId, Number(child.result)])).toEqual([
      ["fleet_training_adder.base", 3_000],
      ["fleet_training_adder.nation", -600],
    ]);
  });

  it("omits the nation adjustment when the nation pays the neutral multiplier", () => {
    const tree = explainTrainingMaintenanceAdder({
      baseAdderBp: 3_000,
      nationMultiplierBp: 10_000,
      adderBp: 3_000,
    });
    expect(tree.children?.map((child) => child.formulaId)).toEqual(["fleet_training_adder.base"]);
  });

  it("explains months to proficiency as the threshold less the funded months", () => {
    const tree = explainTrainingProgress(5, 12);
    expect(tree.formulaId).toBe("fleet_training_progress");
    expect(Number(tree.result)).toBe(7);
    expect(tree.children?.reduce((sum, child) => sum + Number(child.result), 0)).toBe(7);
    expect(tree.children?.map((child) => child.formulaId)).toEqual([
      "fleet_training_progress.proficiency",
      "fleet_training_progress.funded",
    ]);
  });

  it("never reports negative months after the threshold is met", () => {
    expect(Number(explainTrainingProgress(12, 12).result)).toBe(0);
    expect(Number(explainTrainingProgress(15, 12).result)).toBe(0);
  });

  it("explains service experience as the monthly step limited by the cap", () => {
    const step = explainServiceExperience({ monthlyGrowth: 1, cap: 40, current: 20 });
    expect(step.formulaId).toBe("division_service_experience");
    expect(Number(step.result)).toBe(1);
    expect(step.source).toEqual({
      kind: "ruleset",
      ref: "fleet_management.divisionExperience.service",
    });
    expect(
      Number(explainServiceExperience({ monthlyGrowth: 3, cap: 40, current: 39 }).result),
    ).toBe(1);
    expect(
      Number(explainServiceExperience({ monthlyGrowth: 1, cap: 40, current: 55 }).result),
    ).toBe(0);
  });

  it("explains the exercise gain from the fleet-management content value", () => {
    const tree = explainExerciseGain(5);
    expect(tree.formulaId).toBe("fleet_exercise_gain");
    expect(Number(tree.result)).toBe(5);
    expect(tree.source).toEqual({
      kind: "content",
      ref: "fleet_management.divisionExperience.perExercise",
    });
    expect(tree.operation).toBe("identity");
  });

  it("explains the exercise tension from the ruleset threshold, step and ceiling", () => {
    const tree = explainExerciseTension({ minShips: 4, increase: 1, ceiling: 5 }, 3);
    expect(tree.formulaId).toBe("fleet_exercise_tension");
    expect(Number(tree.result)).toBe(3);
    expect(tree.source).toEqual({ kind: "ruleset", ref: "fleet_management.exercise.tension" });
    expect(tree.inputs).toEqual({ minShips: 4, increase: 1, ceiling: 5 });
    expect((tree.children ?? []).map((c) => [c.formulaId, Number(c.result)])).toEqual([
      ["fleet_exercise_tension.threshold", 4],
      ["fleet_exercise_tension.step", 1],
      ["fleet_exercise_tension.ceiling", 5],
    ]);
  });

  it("explains the trade protection quota as a fleet share plus an economy term", () => {
    const tree = explainTradeQuota(
      { fleetShareBp: 1_000, resourcesPerRequiredShip: 400 },
      13,
      1_000,
      4,
    );
    expect(tree.formulaId).toBe("fleet_trade_quota");
    expect(Number(tree.result)).toBe(4);
    expect(tree.source).toEqual({ kind: "ruleset", ref: "trade_protection" });
    expect(tree.inputs).toEqual({
      fleetShips: 13,
      baseResources: 1_000,
      fleetShareBp: 1_000,
      resourcesPerRequiredShip: 400,
    });
    expect((tree.children ?? []).map((c) => [c.formulaId, Number(c.result)])).toEqual([
      ["fleet_trade_quota.fleet", 2],
      ["fleet_trade_quota.economy", 2],
    ]);
  });

  it("explains the assigned count and names the ships that hold the duty without counting", () => {
    const tree = explainTradeAssigned(3, 5);
    expect(tree.formulaId).toBe("fleet_trade_assigned");
    expect(Number(tree.result)).toBe(3);
    expect((tree.children ?? []).map((c) => [c.formulaId, Number(c.result)])).toEqual([
      ["fleet_trade_assigned.holding", 5],
      ["fleet_trade_assigned.excluded", -2],
    ]);
    expect(explainTradeAssigned(4, 4).children?.map((c) => c.formulaId)).toEqual([
      "fleet_trade_assigned.holding",
    ]);
  });

  it("explains the shortfall in basis points of the quota", () => {
    const tree = explainTradeShortfall(4, 1, 3, 7_500);
    expect(tree.formulaId).toBe("fleet_trade_shortfall");
    expect(Number(tree.result)).toBe(7_500);
    expect(tree.inputs).toEqual({ quota: 4, assigned: 1 });
    expect(Number(tree.intermediate["shortfall"])).toBe(3);
    expect(Number(explainTradeShortfall(4, 6, 0, 0).result)).toBe(0);
  });
});
