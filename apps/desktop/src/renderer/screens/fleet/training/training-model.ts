import type {
  FleetScreenProjection,
  FleetTrainingProjection,
  TrainingSubjectId,
} from "../../../../shared/fleet-contract.js";
import type { RequestLifecycle } from "../../../lib/command-screen-workflow.js";

export interface TrainingState extends RequestLifecycle {
  readonly training: FleetTrainingProjection | null;
}

export function initialTrainingState(): TrainingState {
  return {
    revision: 0,
    training: null,
    pendingRequest: null,
    requiresRefresh: false,
    notice: null,
  };
}

export function projectTraining(projection: FleetScreenProjection): Partial<TrainingState> {
  return { training: projection.training ?? null };
}

export const TRAINING_SUBJECT_LABELS: Readonly<Record<TrainingSubjectId, string>> = {
  GUNNERY: "Gunnery",
  NIGHT_FIGHTING: "Night fighting",
  TORPEDO_TACTICS: "Torpedo tactics",
  DAMAGE_CONTROL: "Damage control",
};

export function fundedSubjects(training: FleetTrainingProjection): TrainingSubjectId[] {
  return training.subjects.filter((subject) => subject.funded).map((subject) => subject.subject);
}

export function toggledSubjects(
  training: FleetTrainingProjection,
  subject: TrainingSubjectId,
): TrainingSubjectId[] {
  const current = fundedSubjects(training);
  return current.includes(subject)
    ? current.filter((candidate) => candidate !== subject)
    : [...current, subject];
}

export function canFundMore(training: FleetTrainingProjection): boolean {
  return fundedSubjects(training).length < training.maxSubjects;
}

export function adderText(maintenanceAdderBp: number): string {
  return `+${maintenanceAdderBp / 100}% maintenance on active ships`;
}

export function progressText(
  subject: FleetTrainingProjection["subjects"][number],
  proficiencyMonths: number,
): string {
  if (!subject.funded) return "Not funded";
  if (subject.proficient) return "Proficient";
  return `${subject.fundedMonths} of ${proficiencyMonths} months`;
}
