import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const annualGrowthBp = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 300, maximum: 500 }),
);

export const BaseGrowthRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  nations: Schema.Record(
    Schema.String,
    Schema.Struct({
      annualGrowthBp,
      provenance: ProvenanceSchema,
    }),
  ),
});

export type BaseGrowthRules = typeof BaseGrowthRulesSchema.Type;

export type BaseGrowthRulesDecoded =
  | { readonly ok: true; readonly value: BaseGrowthRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeBaseGrowthRules(input: unknown): BaseGrowthRulesDecoded {
  const result = Schema.decodeUnknownResult(BaseGrowthRulesSchema, {
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
