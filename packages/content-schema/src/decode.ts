import { Schema } from "effect";

/**
 * The strictness policy for every `@bluewave/content-schema` boundary: unmodeled
 * (excess) keys are rejected. This preserves the previous Zod `.strict()`
 * rejection exactly and tightens previously-open `z.object` schemas fail-closed
 * (never a weakening). Recorded in ADR-0105.
 */
export const CONTENT_DECODE_OPTIONS = { onExcessProperty: "error" } as const;

/** An Effect schema that decodes unknown input without requiring any services. */
export type ContentSchema<T = unknown> = Schema.ConstraintDecoder<T, never>;

/**
 * Decode untrusted content input with the strict content-schema policy. Throws on
 * failure — the `Schema.parse` replacement with the strict excess-key option.
 */
export function decodeStrict<A>(schema: ContentSchema<A>, data: unknown): A {
  return Schema.decodeUnknownSync(schema, CONTENT_DECODE_OPTIONS)(data);
}

/**
 * Decode untrusted content input with the strict content-schema policy, returning
 * a `Result` (`_tag` is `"Success"` | `"Failure"`) — the `Schema.safeParse`
 * replacement with the strict excess-key option.
 */
export function decodeStrictResult<A>(schema: ContentSchema<A>, data: unknown) {
  return Schema.decodeUnknownResult(schema, CONTENT_DECODE_OPTIONS)(data);
}
