import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

export const PeaceBehaviourRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  acceptanceScoreMargin: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 1_000 }),
  ),
  proposalChanceBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: 10_000 }),
  ),
  provenance: ProvenanceSchema,
});

export type PeaceBehaviourRules = typeof PeaceBehaviourRulesSchema.Type;

export type PeaceBehaviourRulesDecoded =
  | { readonly ok: true; readonly value: PeaceBehaviourRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodePeaceBehaviourRules(input: unknown): PeaceBehaviourRulesDecoded {
  const result = Schema.decodeUnknownResult(PeaceBehaviourRulesSchema, {
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
