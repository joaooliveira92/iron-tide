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

export function trainingAdderBp(
  rules: SpecialTrainingRules,
  subject: TrainingSubject,
  nationId: string | undefined,
): number {
  const base = rules.subjects[subject].maintenanceAdderBp;
  const multiplier =
    nationId === undefined
      ? NEUTRAL_COST_BP
      : (rules.nationCostMultiplierBp?.[nationId] ?? NEUTRAL_COST_BP);
  return Math.floor((base * multiplier) / NEUTRAL_COST_BP);
}

export type TrainingRefusal =
  | typeof TRAINING_SUBJECT_LIMIT_EXCEEDED
  | typeof TRAINING_SUBJECT_INVALID;

const SUBJECT_ORDER: ReadonlyMap<string, number> = new Map(
  TRAINING_SUBJECTS.map((subject, index) => [subject, index]),
);

export function isTrainingSubject(value: unknown): value is TrainingSubject {
  return typeof value === "string" && SUBJECT_ORDER.has(value);
}

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
    .sort((a, b) => (SUBJECT_ORDER.get(a) ?? 0) - (SUBJECT_ORDER.get(b) ?? 0))
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
