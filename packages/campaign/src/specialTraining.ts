import { Schema } from "effect";
import { SafeInt } from "@bluewave/contracts";

export const TRAINING_SUBJECTS = [
  "GUNNERY",
  "NIGHT_FIGHTING",
  "TORPEDO_TACTICS",
  "DAMAGE_CONTROL",
] as const;
export type TrainingSubject = (typeof TRAINING_SUBJECTS)[number];

export const TRAINING_DORMANT = "TRAINING_DORMANT" as const;
export const TRAINING_SUBJECT_LIMIT_EXCEEDED = "TRAINING_SUBJECT_LIMIT_EXCEEDED" as const;
export const TRAINING_SUBJECT_INVALID = "TRAINING_SUBJECT_INVALID" as const;

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

export const TrainingSubjectEntrySchema = Schema.Struct({
  subject: Schema.Literals(TRAINING_SUBJECTS),
  fundedMonths: nonNegativeInt,
  maintenanceAdderBp: nonNegativeInt,
});
export type TrainingSubjectEntry = typeof TrainingSubjectEntrySchema.Type;

export interface SpecialTrainingRules {
  readonly proficiencyMonths: number;
  readonly maxSubjects: number;
  readonly subjects: Readonly<Record<TrainingSubject, { readonly maintenanceAdderBp: number }>>;
  readonly nationCostMultiplierBp?: Readonly<Record<string, number>>;
}

const NEUTRAL_COST_BP = 10_000;

export interface TrainingAdderDetail {
  readonly baseAdderBp: number;
  readonly nationMultiplierBp: number;
  readonly adderBp: number;
}

export function trainingAdderDetail(
  rules: SpecialTrainingRules,
  subject: TrainingSubject,
  nationId: string | undefined,
): TrainingAdderDetail {
  const baseAdderBp = rules.subjects[subject].maintenanceAdderBp;
  const nationMultiplierBp =
    nationId === undefined
      ? NEUTRAL_COST_BP
      : (rules.nationCostMultiplierBp?.[nationId] ?? NEUTRAL_COST_BP);
  return {
    baseAdderBp,
    nationMultiplierBp,
    adderBp: Math.floor((baseAdderBp * nationMultiplierBp) / NEUTRAL_COST_BP),
  };
}

export function trainingAdderBp(
  rules: SpecialTrainingRules,
  subject: TrainingSubject,
  nationId: string | undefined,
): number {
  return trainingAdderDetail(rules, subject, nationId).adderBp;
}

export type TrainingRefusal =
  | typeof TRAINING_SUBJECT_LIMIT_EXCEEDED
  | typeof TRAINING_SUBJECT_INVALID;

export const isTrainingSubject = Schema.is(TrainingSubjectEntrySchema.fields.subject);

const subjectRank = (subject: TrainingSubject) => TRAINING_SUBJECTS.indexOf(subject);

export function trainingRefusal(
  subjects: readonly unknown[],
  rules: Pick<SpecialTrainingRules, "maxSubjects">,
): TrainingRefusal | null {
  if (
    subjects.some((subject) => !isTrainingSubject(subject)) ||
    new Set(subjects).size !== subjects.length
  )
    return TRAINING_SUBJECT_INVALID;
  if (subjects.length > rules.maxSubjects) return TRAINING_SUBJECT_LIMIT_EXCEEDED;
  return null;
}

export function fundSpecialTraining(
  current: readonly TrainingSubjectEntry[] | undefined,
  subjects: readonly TrainingSubject[],
  rules: SpecialTrainingRules,
  nationId?: string,
): TrainingSubjectEntry[] {
  const existing = new Map((current ?? []).map((entry) => [entry.subject, entry]));
  return [...subjects]
    .sort((a, b) => subjectRank(a) - subjectRank(b))
    .map(
      (subject) =>
        existing.get(subject) ?? {
          subject,
          fundedMonths: 0,
          maintenanceAdderBp: trainingAdderBp(rules, subject, nationId),
        },
    );
}

export function advanceSpecialTraining(
  program: readonly TrainingSubjectEntry[] | undefined,
  proficiencyMonths: number,
): TrainingSubjectEntry[] | undefined {
  if (program === undefined || program.length === 0) return program === undefined ? undefined : [];
  return program.map((entry) => ({
    ...entry,
    fundedMonths: Math.min(proficiencyMonths, entry.fundedMonths + 1),
  }));
}

export function isTrainingProficient(
  entry: Pick<TrainingSubjectEntry, "fundedMonths">,
  proficiencyMonths: number,
): boolean {
  return entry.fundedMonths >= proficiencyMonths;
}

export function trainingMaintenanceAdderBp(
  program: readonly Pick<TrainingSubjectEntry, "maintenanceAdderBp">[] | undefined,
): SafeInt {
  let total = SafeInt.ZERO;
  for (const entry of program ?? []) total = SafeInt.add(total, SafeInt(entry.maintenanceAdderBp));
  return total;
}
