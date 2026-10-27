import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));
const basisPoints = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10_000 }),
);

export const MissileClassRulesSchema = Schema.Struct({
  rangeM: positiveInt,
  flightTimeSeconds: positiveInt,
  salvoSize: positiveInt,
  baseHitBp: basisPoints,
  structuralDamage: positiveInt,
  flotationDamage: nonNegativeInt,
  defenceInterceptBp: basisPoints,
  maxSalvosPerBattle: positiveInt,
});

export const MissilesRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  classes: Schema.Struct({
    light_ssm: MissileClassRulesSchema,
    medium_ssm: MissileClassRulesSchema,
    heavy_ssm: MissileClassRulesSchema,
  }),
  provenance: ProvenanceSchema,
});

export type MissileClassRules = typeof MissileClassRulesSchema.Type;
export type MissilesRules = typeof MissilesRulesSchema.Type;

export type MissilesRulesDecoded =
  | { readonly ok: true; readonly value: MissilesRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeMissilesRules(input: unknown): MissilesRulesDecoded {
  const result = Schema.decodeUnknownResult(MissilesRulesSchema, {
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
