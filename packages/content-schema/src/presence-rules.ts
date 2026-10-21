import { Result, Schema, SchemaIssue } from "effect";

import { CONTENT_DECODE_OPTIONS } from "./decode.js";
import { ProvenanceSchema } from "./provenance.js";

/**
 * The optional S-5 ruleset section (spec #73 R11, ADR-0242): every foreign-station and presence value in one
 * versioned block with provenance. Absent = dormant, and no numeric default is ever substituted. A present section
 * is all-or-nothing, so a half-authored one cannot silently switch mechanics on. Later S-5 tickets add their
 * required values here (S-5 04 declared the colonial-service fitting; S-5 05 adds the requirement function and the
 * counting fraction). No value has a default.
 */
export const PresenceRulesSchema = Schema.Struct({
  /** Proportion of a design's target displacement a colonial-service fitting takes (manual p.42), in basis points. */
  colonialServiceDisplacementBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 9_999 }),
  ),
  /**
   * Presence requirement (manual p.46, decision request 0016, resolved as an ADR-0213 `balance_adjustment`): for each
   * nation and area, required tons = sum over the nation's possessions in the area of
   * `requiredTonsPerPossessionWeight` x `valueWeight`, where `valueWeight` is the integer level of the nation's best
   * port in that area, or `noPortValueWeight` when the nation has no port there. Integer tons.
   */
  requiredTonsPerPossessionWeight: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  /** The flat `valueWeight` a possession takes in an area where its nation has no port (decision request 0016). */
  noPortValueWeight: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  /**
   * The share of a ship's tonnage that counts toward presence when it is cramped or short-range (manual p.46), in basis
   * points; strictly below 10_000. Applied once when either applies (decision request 0020 leaves the combination open).
   */
  crampedOrShortRangeCountBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 9_999 }),
  ),
  /**
   * Penalty parameters (spec #73 R8, ADR-0248): when `true`, every presence shortfall also emits typed prestige-loss and
   * revolt-pressure requests for S-2/S-3. A flag, not a magnitude: magnitudes and the revolt trigger are gated (decision
   * request 0023) and belong to the consumers. Absent = no requests.
   */
  penaltyRequests: Schema.optional(Schema.Literal(true)),
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
