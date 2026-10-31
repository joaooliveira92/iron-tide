import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { EventStanceSchema } from "./event.js";
import { NationTraitSchema } from "./nation.js";
import { ProvenanceSchema } from "./provenance.js";

const basisPoints = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10_000 }),
);
const signedBasisPoints = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: -10_000, maximum: 10_000 }),
);

export const EventStanceWeightsSchema = Schema.Struct({
  hawkBp: basisPoints,
  doveBp: basisPoints,
  neutralBp: basisPoints,
});
export type EventStanceWeights = typeof EventStanceWeightsSchema.Type;

export const EventTraitShiftSchema = Schema.Struct({
  trait: NationTraitSchema,
  stance: EventStanceSchema,
  deltaBp: signedBasisPoints,
});
export type EventTraitShift = typeof EventTraitShiftSchema.Type;

export const EventResolutionRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  defaultAnswerAfterMonths: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 24 }),
  ),
  aiStanceWeightsBp: Schema.Struct({
    liberal_democracy: EventStanceWeightsSchema,
    limited_democracy: EventStanceWeightsSchema,
    autocratic: EventStanceWeightsSchema,
    fascist: EventStanceWeightsSchema,
    communist: EventStanceWeightsSchema,
    eastern: EventStanceWeightsSchema,
  }),
  traitShifts: Schema.Array(EventTraitShiftSchema).check(
    Schema.makeFilter((shifts) => {
      const keys = shifts.map((shift) => `${shift.trait}/${shift.stance}`);
      return new Set(keys).size === keys.length
        ? undefined
        : "a trait may shift a stance at most once";
    }),
  ),
  provenance: ProvenanceSchema,
}).check(
  Schema.makeFilter((rules) => {
    for (const [governmentType, weights] of Object.entries(rules.aiStanceWeightsBp)) {
      if (weights.hawkBp + weights.doveBp <= 0) {
        return `aiStanceWeightsBp.${governmentType} needs a positive hawk or dove weight`;
      }
    }
    return undefined;
  }),
);

export type EventResolutionRules = typeof EventResolutionRulesSchema.Type;

export type EventResolutionRulesDecoded =
  | { readonly ok: true; readonly value: EventResolutionRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeEventResolutionRules(input: unknown): EventResolutionRulesDecoded {
  const result = Schema.decodeUnknownResult(EventResolutionRulesSchema, {
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
