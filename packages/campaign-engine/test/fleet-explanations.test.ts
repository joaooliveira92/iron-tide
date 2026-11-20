import { describe, expect, it } from "vite-plus/test";
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
});
