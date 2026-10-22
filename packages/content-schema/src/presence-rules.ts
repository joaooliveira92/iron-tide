import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { PORT_LEVEL_MAX } from "./port.js";
import { ProvenanceSchema } from "./provenance.js";

export const BaseLimitRulesSchema = Schema.Struct({
  limitByBaseLevel: Schema.Array(
    Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  ).check(Schema.isBetweenLength(PORT_LEVEL_MAX, PORT_LEVEL_MAX)),
  noBaseLimit: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  occupyingStates: Schema.Array(
    Schema.Literals(["ACTIVE", "RESERVE", "MOTHBALLED", "WORKING_UP", "REPAIR"]),
  ).check(Schema.isBetweenLength(1, 5), Schema.isUnique()),
  maintenanceAdderBp: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  crewQualityReduction: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: 100 }),
  ),
});

export const PresenceRulesSchema = Schema.Struct({
  colonialServiceDisplacementBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 9_999 }),
  ),
  requiredTonsPerPossessionWeight: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  noPortValueWeight: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  crampedOrShortRangeCountBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 9_999 }),
  ),
  penaltyRequests: Schema.optional(Schema.Literal(true)),
  baseLimits: Schema.optional(BaseLimitRulesSchema),
  provenance: ProvenanceSchema,
});

export type PresenceRules = typeof PresenceRulesSchema.Type;

export type PresenceRulesDecoded =
  | { readonly ok: true; readonly value: PresenceRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

export function decodePresenceRules(input: unknown): PresenceRulesDecoded {
  const result = Schema.decodeUnknownResult(PresenceRulesSchema, {
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
