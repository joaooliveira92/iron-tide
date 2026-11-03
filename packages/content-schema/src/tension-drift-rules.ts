import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const basisPoints = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 10_000 }),
);

export const TensionDriftRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  maxRiseProbabilityBp: basisPoints,
  navalRatio: Schema.Struct({
    thresholdBp: Schema.Finite.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 10_001, maximum: 1_000_000 }),
    ),
    pressureBp: basisPoints,
    tensionCeiling: Schema.Finite.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 0, maximum: 10 }),
    ),
  }),
  damping: Schema.Struct({ alliedBp: basisPoints, tradeAgreementBp: basisPoints }),
  cooling: Schema.Struct({ alliedBp: basisPoints, tradeAgreementBp: basisPoints }),
  provenance: ProvenanceSchema,
});

export type TensionDriftRules = typeof TensionDriftRulesSchema.Type;

export type TensionDriftRulesDecoded =
  | { readonly ok: true; readonly value: TensionDriftRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeTensionDriftRules(input: unknown): TensionDriftRulesDecoded {
  const result = Schema.decodeUnknownResult(TensionDriftRulesSchema, {
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
