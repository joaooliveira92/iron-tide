import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { nationMonthlyMaintenance } from "../src/maintenance.js";
import {
  advanceSpecialTraining,
  fundSpecialTraining,
  isTrainingProficient,
  TrainingSubjectEntrySchema,
  trainingMaintenanceAdderBp,
  trainingRefusal,
  type SpecialTrainingRules,
} from "../src/specialTraining.js";
import { SafeInt } from "@bluewave/contracts";

const RULES: SpecialTrainingRules = {
  proficiencyMonths: 12,
  maxSubjects: 2,
  subjects: {
    GUNNERY: { maintenanceAdderBp: 3000 },
    NIGHT_FIGHTING: { maintenanceAdderBp: 2000 },
    TORPEDO_TACTICS: { maintenanceAdderBp: 2000 },
    DAMAGE_CONTROL: { maintenanceAdderBp: 2000 },
  },
};

describe("trainingRefusal", () => {
  it("allows up to the limit and refuses a third, unknown or repeated subject with a typed code", () => {
    expect(trainingRefusal([], RULES)).toBeNull();
    expect(trainingRefusal(["GUNNERY", "NIGHT_FIGHTING"], RULES)).toBeNull();
    expect(trainingRefusal(["GUNNERY", "NIGHT_FIGHTING", "DAMAGE_CONTROL"], RULES)).toBe(
      "TRAINING_SUBJECT_LIMIT_EXCEEDED",
    );
    expect(trainingRefusal(["SEAMANSHIP"], RULES)).toBe("TRAINING_SUBJECT_INVALID");
    expect(trainingRefusal(["GUNNERY", "GUNNERY"], RULES)).toBe("TRAINING_SUBJECT_INVALID");
  });
});

describe("fundSpecialTraining", () => {
  it("orders subjects canonically, starts new ones at zero and keeps the progress of kept ones", () => {
    const first = fundSpecialTraining(undefined, ["NIGHT_FIGHTING", "GUNNERY"], RULES);
    expect(first.map((e) => [e.subject, e.fundedMonths, e.maintenanceAdderBp])).toEqual([
      ["GUNNERY", 0, 3000],
      ["NIGHT_FIGHTING", 0, 2000],
    ]);
    const advanced = advanceSpecialTraining(first, 12)!;
    const next = fundSpecialTraining(advanced, ["GUNNERY", "DAMAGE_CONTROL"], RULES);
    expect(next.map((e) => [e.subject, e.fundedMonths])).toEqual([
      ["GUNNERY", 1],
      ["DAMAGE_CONTROL", 0],
    ]);
  });

  it("drops every subject when none is funded", () => {
    expect(fundSpecialTraining(advanceSpecialTraining([], 12), [], RULES)).toEqual([]);
  });
});

describe("advanceSpecialTraining", () => {
  it("counts a funded month and stops at proficiency", () => {
    let program = fundSpecialTraining(undefined, ["GUNNERY"], RULES);
    for (let month = 0; month < 15; month++) program = advanceSpecialTraining(program, 12)!;
    expect(program[0]!.fundedMonths).toBe(12);
    expect(isTrainingProficient(program[0]!, 12)).toBe(true);
    expect(isTrainingProficient({ fundedMonths: 11 }, 12)).toBe(false);
  });

  it("leaves a nation without a program without one", () => {
    expect(advanceSpecialTraining(undefined, 12)).toBeUndefined();
  });
});

describe("training maintenance adder", () => {
  const ship = (readiness: "ACTIVE" | "MOTHBALLED") => ({
    hitPoints: SafeInt(100),
    readiness,
  });

  it("sums the subjects' percentages and raises only ACTIVE ships", () => {
    const program = fundSpecialTraining(undefined, ["GUNNERY", "NIGHT_FIGHTING"], RULES);
    const adder = trainingMaintenanceAdderBp(program);
    expect(adder as number).toBe(5000);
    const fleets = [{ ships: [ship("ACTIVE"), ship("MOTHBALLED")] }];
    const base = nationMonthlyMaintenance(fleets, false) as number;
    expect(nationMonthlyMaintenance(fleets, false, adder) as number).toBe(base + 5);
    expect(trainingMaintenanceAdderBp(undefined) as number).toBe(0);
  });
});

describe("TrainingSubjectEntrySchema", () => {
  const decode = Schema.decodeUnknownResult(TrainingSubjectEntrySchema, {
    onExcessProperty: "error",
  });

  it("accepts a stored entry and rejects unknown subjects, negatives, fractions and extras", () => {
    expect(
      Result.isSuccess(decode({ subject: "GUNNERY", fundedMonths: 3, maintenanceAdderBp: 3000 })),
    ).toBe(true);
    for (const bad of [
      { subject: "SEAMANSHIP", fundedMonths: 3, maintenanceAdderBp: 3000 },
      { subject: "GUNNERY", fundedMonths: -1, maintenanceAdderBp: 3000 },
      { subject: "GUNNERY", fundedMonths: 1.5, maintenanceAdderBp: 3000 },
      { subject: "GUNNERY", fundedMonths: 3, maintenanceAdderBp: 3000, extra: 1 },
      { subject: "GUNNERY", fundedMonths: 3 },
    ]) {
      expect(Result.isFailure(decode(bad))).toBe(true);
    }
  });
});
