import type {
  FleetScreenProjection,
  FleetTrainingProjection,
  FleetTrainingSelectionView,
  TrainingSubjectId,
} from "../../../../shared/fleet-contract.js";
import type { RequestLifecycle } from "../../../lib/command-screen-workflow.js";
import { format } from "../station/fleet-station-state.js";

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

const TRAINING_SUBJECT_ORDER: readonly TrainingSubjectId[] = [
  "GUNNERY",
  "NIGHT_FIGHTING",
  "TORPEDO_TACTICS",
  "DAMAGE_CONTROL",
];

export function subjectLabel(subject: TrainingSubjectId): string {
  return format(`fleet.training.subject.${subject}`);
}

export function selectionKey(subjects: readonly TrainingSubjectId[]): string {
  return TRAINING_SUBJECT_ORDER.filter((subject) => subjects.includes(subject)).join("+");
}

export function selectionFor(
  training: FleetTrainingProjection,
  subjects: readonly TrainingSubjectId[],
): FleetTrainingSelectionView | undefined {
  const key = selectionKey(subjects);
  return training.selections.find((entry) => selectionKey(entry.subjects) === key);
}

export function fundedSubjects(training: FleetTrainingProjection): TrainingSubjectId[] {
  return training.subjects.filter((subject) => subject.funded).map((subject) => subject.subject);
}

export function sameSubjects(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

export function adderText(maintenanceAdderBp: number): string {
  return format("fleet.training.adder", { percent: maintenanceAdderBp / 100 });
}

export function effectText(subject: TrainingSubjectId, effectBp: number): string {
  return format(`fleet.training.effect.${subject}`, { percent: effectBp / 100 });
}

export function progressText(
  subject: FleetTrainingProjection["subjects"][number],
  proficiencyMonths: number,
): string {
  if (!subject.funded) return format("fleet.training.progress.notFunded");
  if (subject.proficient) return format("fleet.training.progress.proficient");
  return format("fleet.training.progress.months", {
    funded: subject.fundedMonths,
    months: proficiencyMonths,
  });
}
