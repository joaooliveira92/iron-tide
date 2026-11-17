import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

const points = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 }));

export const FleetMoraleRulesSchema = Schema.Struct({
  sectionVersion: Schema.Literal(1),
  unpaidFundsLoss: points,
  blockadeCrampedLoss: points,
  longWarMonths: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 240 }),
  ),
  recoveryPerMonth: points,
  provenance: ProvenanceSchema,
});

export type FleetMoraleRules = typeof FleetMoraleRulesSchema.Type;

export type FleetMoraleRulesDecoded =
  | { readonly ok: true; readonly value: FleetMoraleRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodeFleetMoraleRules(input: unknown): FleetMoraleRulesDecoded {
  const result = Schema.decodeUnknownResult(FleetMoraleRulesSchema, {
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
