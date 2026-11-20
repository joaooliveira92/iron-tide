import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

export const WarDeclarationRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  tensionThreshold: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 10 }),
  ),
  minimumNavalStrengthRatioBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 100_000 }),
  ),
  provenance: ProvenanceSchema,
});

export type WarDeclarationRules = typeof WarDeclarationRulesSchema.Type;

export type WarDeclarationRulesDecoded =
  | { readonly ok: true; readonly value: WarDeclarationRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeWarDeclarationRules(input: unknown): WarDeclarationRulesDecoded {
  const result = Schema.decodeUnknownResult(WarDeclarationRulesSchema, {
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
