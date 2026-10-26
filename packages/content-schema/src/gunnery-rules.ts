import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const radarLevel = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 3 }),
);
const levelTable = Schema.Tuple([nonNegativeInt, nonNegativeInt, nonNegativeInt]);

export const GunneryRadarRulesSchema = Schema.Struct({
  accuracyBpByFireControlLevel: levelTable,
  blindFireMinLevel: radarLevel,
  airDefenseSaturationBpBySearchLevel: levelTable,
});

export const GunneryRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  radar: GunneryRadarRulesSchema,
  provenance: ProvenanceSchema,
});

export type GunneryRules = typeof GunneryRulesSchema.Type;

export type GunneryRulesDecoded =
  | { readonly ok: true; readonly value: GunneryRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeGunneryRules(input: unknown): GunneryRulesDecoded {
  const result = Schema.decodeUnknownResult(GunneryRulesSchema, {
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
