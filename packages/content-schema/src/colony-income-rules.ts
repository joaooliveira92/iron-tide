import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const int = Schema.Finite.check(Schema.isInt());

export const ColonyIncomeRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  baselineYear: int.check(Schema.isBetween({ minimum: 1000, maximum: 3000 })),
  startFactorBp: int.check(Schema.isBetween({ minimum: 1, maximum: 10_000 })),
  slopeBpPerYear: int.check(Schema.isBetween({ minimum: 0, maximum: 10_000 })),
  floorBp: int.check(Schema.isBetween({ minimum: 0, maximum: 10_000 })),
  provenance: ProvenanceSchema,
}).check(
  Schema.makeFilter((rules) =>
    rules.floorBp <= rules.startFactorBp ? undefined : "floorBp must be <= startFactorBp",
  ),
);

export type ColonyIncomeRules = typeof ColonyIncomeRulesSchema.Type;

export type ColonyIncomeRulesDecoded =
  | { readonly ok: true; readonly value: ColonyIncomeRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeColonyIncomeRules(input: unknown): ColonyIncomeRulesDecoded {
  const result = Schema.decodeUnknownResult(ColonyIncomeRulesSchema, {
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
