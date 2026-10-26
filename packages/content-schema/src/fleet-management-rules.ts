import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1));
const points = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 100 }));
const basisPoints = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10_000 }),
);
const costMultiplierBp = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 5_000, maximum: 10_000 }),
);

export const FLEET_TRAINING_SUBJECTS = [
  "GUNNERY",
  "NIGHT_FIGHTING",
  "TORPEDO_TACTICS",
  "DAMAGE_CONTROL",
] as const;

export const FleetTrainingSubjectSchema = Schema.Struct({
  maintenanceAdderBp: basisPoints,
  effectBp: basisPoints,
});

export const FleetReorganisationPenaltySchema = Schema.Struct({
  cohesion: points,
  experience: points,
});

export const FleetManagementRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  divisionCohesion: Schema.Struct({ monthlyGrowth: points, cap: points }),
  divisionExperience: Schema.Struct({ perBattle: points, perExercise: points }),
  reorganisationPenalty: Schema.Struct({
    roleChange: FleetReorganisationPenaltySchema,
    formationChange: FleetReorganisationPenaltySchema,
  }),
  training: Schema.Struct({
    proficiencyMonths: positiveInt,
    maxSubjects: Schema.Finite.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: FLEET_TRAINING_SUBJECTS.length }),
    ),
    nationCostMultiplierBp: Schema.optionalKey(
      Schema.Record(Schema.NonEmptyString, costMultiplierBp),
    ),
    subjects: Schema.Struct({
      GUNNERY: FleetTrainingSubjectSchema,
      NIGHT_FIGHTING: FleetTrainingSubjectSchema,
      TORPEDO_TACTICS: FleetTrainingSubjectSchema,
      DAMAGE_CONTROL: FleetTrainingSubjectSchema,
    }),
  }),
  exercise: Schema.Struct({
    maintenanceMultiple: positiveInt,
    maxPerCalendarYear: nonNegativeInt,
    tension: Schema.optionalKey(
      Schema.Struct({
        minShips: positiveInt,
        increase: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 5 })),
        ceiling: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 9 })),
      }),
    ),
  }),
  provenance: ProvenanceSchema,
});

export type FleetManagementRules = typeof FleetManagementRulesSchema.Type;

export type FleetManagementRulesDecoded =
  | { readonly ok: true; readonly value: FleetManagementRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeFleetManagementRules(input: unknown): FleetManagementRulesDecoded {
  const result = Schema.decodeUnknownResult(FleetManagementRulesSchema, {
    ...CONTENT_DECODE_OPTIONS,
    errors: "all",
  })(input);
  if (Result.isSuccess(result)) return { ok: true, value: result.success };
  const [first] = formatter(result.failure.issue).issues;
  const path = (first?.path ?? []).filter(
    (key): key is string | number => typeof key === "string" || typeof key === "number",
  );
  return {
    ok: false,
    field: path.length > 0 ? path.join(".") : "(root)",
    message: first?.message ?? "is invalid",
  };
}
