import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { GovernmentTypeSchema } from "./nation.js";
import { ProvenanceSchema } from "./provenance.js";

const level = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 10 }));
const rise = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 5 }));
const basisPoints = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 10_000 }),
);

export const UnrestRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  referenceRateBp: basisPoints,
  spendingStepBp: basisPoints,
  spendingMaxRise: rise,
  spendingMaxCut: rise,
  warOutbreakRelief: rise,
  warDurationMonths: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 240 }),
  ),
  warDurationRise: rise,
  blockadeRise: rise,
  defeatRise: rise,
  victoryRelief: rise,
  crampedWarRise: rise,
  crampedBlockadeRise: rise,
  strikeThreshold: level,
  strikeRateStepBp: basisPoints,
  revolutionThreshold: level,
  revolutionProbabilityBp: basisPoints,
  liberalDemocracyDampingBp: basisPoints,
  aftermathUnrest: level,
  governmentAfterRevolution: Schema.optional(
    Schema.Struct({
      liberal_democracy: GovernmentTypeSchema,
      limited_democracy: GovernmentTypeSchema,
      autocratic: GovernmentTypeSchema,
      fascist: GovernmentTypeSchema,
      communist: GovernmentTypeSchema,
      eastern: GovernmentTypeSchema,
    }),
  ),
  provenance: ProvenanceSchema,
});

export type UnrestRules = typeof UnrestRulesSchema.Type;

export type UnrestRulesDecoded =
  | { readonly ok: true; readonly value: UnrestRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeUnrestRules(input: unknown): UnrestRulesDecoded {
  const result = Schema.decodeUnknownResult(UnrestRulesSchema, {
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
