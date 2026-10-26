import type { TrainingAdderDetail } from "@bluewave/campaign";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const FLEET_FORMULA_VERSION = "fleet_v1";

const SOURCE = { kind: "code", ref: "packages/campaign/src/presence.ts" } as const;
const TRAINING_SOURCE = {
  kind: "content",
  ref: "fleet_management.training.subjects",
} as const;
const TRAINING_ADVANCE_SOURCE = {
  kind: "code",
  ref: "packages/campaign/src/specialTraining.ts",
} as const;
const EXERCISE_SOURCE = {
  kind: "content",
  ref: "fleet_management.divisionExperience.perExercise",
} as const;
const UNIT_TONS = "tons";
const UNIT_BP = "bp";
const UNIT_MONTHS = "months";

function tonChild(formulaId: string, amount: number): ExplanationTree {
  return new ExplanationBuilder(formulaId, FLEET_FORMULA_VERSION)
    .withInput("amount", Math.abs(amount))
    .withResult(amount)
    .withUnit(UNIT_TONS)
    .withSource(SOURCE)
    .build();
}

function bpChild(formulaId: string, amount: number): ExplanationTree {
  return new ExplanationBuilder(formulaId, FLEET_FORMULA_VERSION)
    .withInput("amount", amount)
    .withResult(amount)
    .withUnit(UNIT_BP)
    .withSource(TRAINING_SOURCE)
    .build();
}

export function explainTrainingMaintenanceAdder(detail: TrainingAdderDetail): ExplanationTree {
  const nationAdjustment = detail.adderBp - detail.baseAdderBp;
  const builder = new ExplanationBuilder("fleet_training_adder", FLEET_FORMULA_VERSION)
    .withInput("baseAdderBp", detail.baseAdderBp)
    .withInput("nationMultiplierBp", detail.nationMultiplierBp)
    .withResult(detail.adderBp)
    .withUnit(UNIT_BP)
    .withOperation("multiply")
    .withSource(TRAINING_SOURCE)
    .addChild(bpChild("fleet_training_adder.base", detail.baseAdderBp));
  if (nationAdjustment !== 0) {
    builder.addChild(bpChild("fleet_training_adder.nation", nationAdjustment));
  }
  return builder.build();
}

export function explainTrainingProgress(
  fundedMonths: number,
  proficiencyMonths: number,
): ExplanationTree {
  const monthsToProficiency = Math.max(0, proficiencyMonths - fundedMonths);
  return new ExplanationBuilder("fleet_training_progress", FLEET_FORMULA_VERSION)
    .withInput("fundedMonths", fundedMonths)
    .withInput("proficiencyMonths", proficiencyMonths)
    .withResult(monthsToProficiency)
    .withUnit(UNIT_MONTHS)
    .withOperation("subtract")
    .withSource(TRAINING_ADVANCE_SOURCE)
    .addChild(
      new ExplanationBuilder("fleet_training_progress.proficiency", FLEET_FORMULA_VERSION)
        .withInput("amount", proficiencyMonths)
        .withResult(proficiencyMonths)
        .withUnit(UNIT_MONTHS)
        .withSource(TRAINING_SOURCE)
        .build(),
    )
    .addChild(
      new ExplanationBuilder("fleet_training_progress.funded", FLEET_FORMULA_VERSION)
        .withInput("amount", fundedMonths)
        .withResult(-fundedMonths)
        .withUnit(UNIT_MONTHS)
        .withSource(TRAINING_ADVANCE_SOURCE)
        .build(),
    )
    .build();
}

export function explainExerciseGain(experienceGain: number): ExplanationTree {
  return new ExplanationBuilder("fleet_exercise_gain", FLEET_FORMULA_VERSION)
    .withInput("perExercise", experienceGain)
    .withResult(experienceGain)
    .withOperation("identity")
    .withSource(EXERCISE_SOURCE)
    .build();
}

export function explainPresenceShortfall(
  requiredTons: number,
  presentTons: number,
  exempt: boolean,
  shortfallTons: number,
): ExplanationTree {
  const rawShortfall = Math.max(0, requiredTons - presentTons);
  const builder = new ExplanationBuilder("fleet_presence", FLEET_FORMULA_VERSION)
    .withInput("requiredTons", requiredTons)
    .withInput("presentTons", presentTons)
    .withInput("exempt", exempt ? "true" : "false")
    .withIntermediate("rawShortfallTons", rawShortfall)
    .withResult(shortfallTons)
    .withUnit(UNIT_TONS)
    .withOperation("subtract")
    .withSource(SOURCE)
    .addChild(tonChild("fleet_presence.required", requiredTons))
    .addChild(tonChild("fleet_presence.present", -presentTons));
  if (exempt && rawShortfall > 0) {
    builder.addChild(tonChild("fleet_presence.exemption", -rawShortfall));
  }
  return builder.build();
}
