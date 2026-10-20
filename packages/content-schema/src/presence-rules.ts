import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

/**
 * The optional S-5 ruleset section (spec #73 R11, ADR-0242): every foreign-station and presence value in one
 * versioned block with provenance. Absent = dormant, and no numeric default is ever substituted. A present section
 * is all-or-nothing, so a half-authored one cannot silently switch mechanics on. Later S-5 tickets add their
 * required values here; this ticket declares the section with the colonial-service fitting's value.
 */
export const PresenceRulesSchema = Schema.Struct({
  /** Proportion of a design's target displacement a colonial-service fitting takes (manual p.42), in basis points. */
  colonialServiceDisplacementBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 9_999 }),
  ),
  provenance: ProvenanceSchema,
});

export type PresenceRules = typeof PresenceRulesSchema.Type;

export type PresenceRulesDecoded =
  | { readonly ok: true; readonly value: PresenceRules }
  | { readonly ok: false; readonly field: string; readonly message: string };

const formatter = SchemaIssue.makeFormatterStandardSchemaV1();

/**
 * Strictly decode the S-5 ruleset section from untrusted input: excess keys are rejected, every field is required,
 * and a failure names the first offending field.
 */
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
