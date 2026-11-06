import { SafeInt } from "@bluewave/contracts";
import { exerciseMaintenanceAdderBp } from "./fleetExercise.js";
import {
  MAINTENANCE_WARTIME_MULTIPLIER_BP,
  nationMonthlyMaintenance,
  type MaintainedFleet,
} from "./maintenance.js";
import {
  fundSpecialTraining,
  TRAINING_SUBJECTS,
  trainingMaintenanceAdderBp,
  type SpecialTrainingRules,
  type TrainingSubject,
  type TrainingSubjectEntry,
} from "./specialTraining.js";
import type { NationState } from "./state.js";

export interface TrainingSelectionCost {
  readonly subjects: readonly TrainingSubject[];
  readonly adderBp: number;
  readonly activeWartimeMultiplierBp: number;
  readonly maintenanceWithoutTraining: number;
  readonly maintenanceWithTraining: number;
  readonly monthlyCost: number;
}

export function trainingSelections(maxSubjects: number): TrainingSubject[][] {
  const selections: TrainingSubject[][] = [[]];
  const extend = (prefix: TrainingSubject[], from: number) => {
    if (prefix.length >= maxSubjects) return;
    for (let index = from; index < TRAINING_SUBJECTS.length; index += 1) {
      const next = [...prefix, TRAINING_SUBJECTS[index]!];
      selections.push(next);
      extend(next, index + 1);
    }
  };
  extend([], 0);
  return selections.sort((a, b) => a.length - b.length);
}

export function trainingSelectionCost(
  nation: Pick<NationState, "id" | "fleets" | "specialTraining" | "fleetExercise">,
  rules: SpecialTrainingRules,
  atWar: boolean,
  month: string,
  subjects: readonly TrainingSubject[],
): TrainingSelectionCost {
  const fleets: readonly MaintainedFleet[] = nation.fleets;
  const exerciseBp = exerciseMaintenanceAdderBp(nation.fleetExercise, month);
  const adders = (trainingBp: SafeInt) => ({
    trainingBp,
    ...(exerciseBp === undefined ? {} : { exerciseBp }),
  });
  const program: readonly TrainingSubjectEntry[] = fundSpecialTraining(
    nation.specialTraining,
    subjects,
    rules,
    nation.id,
  );
  const adderBp = trainingMaintenanceAdderBp(program);
  const without = Number(nationMonthlyMaintenance(fleets, atWar, adders(SafeInt.ZERO)));
  const withTraining = Number(nationMonthlyMaintenance(fleets, atWar, adders(adderBp)));
  return {
    subjects: [...subjects],
    adderBp: Number(adderBp),
    activeWartimeMultiplierBp: atWar ? Number(MAINTENANCE_WARTIME_MULTIPLIER_BP) : 10_000,
    maintenanceWithoutTraining: without,
    maintenanceWithTraining: withTraining,
    monthlyCost: withTraining - without,
  };
}
