import { Schema } from "effect";

/**
 * ENGINEERING-CONTRACT.md's Electron boundary rule requires IPC requests and
 * responses to be validated. The snapshot payload's deep shape is already
 * guaranteed by SaveStore's own hash/envelope verification, so this schema
 * validates the envelope crossing the process boundary rather than
 * re-deriving @bluewave/campaign's full CampaignSnapshot type.
 *
 * Migrated from Zod to Effect Schema (ADR-0102). `Schema.Struct` strips
 * unmodeled keys by default, matching Zod's `z.object` default.
 */
export const LoadSaveRequestSchema = Schema.optional(Schema.String);

export const LoadSaveResultSchema = Schema.Struct({
  success: Schema.Boolean,
  snapshot: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  envelope: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  rawHash: Schema.optional(Schema.String),
  diagnostics: Schema.Array(
    Schema.Struct({
      code: Schema.String,
      severity: Schema.String,
      message: Schema.String,
    }),
  ),
  error: Schema.optional(Schema.String),
});

// Effect Schema's `.Type` is deeply readonly; the decoded runtime value is
// already a plain, mutable JavaScript object, so this alias restores the
// mutable shape existing callers compile against (matching
// `@bluewave/persistence`'s `schemas.ts`).
type Mutable<T> =
  T extends ReadonlyArray<infer U>
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

export type LoadSaveResult = Mutable<typeof LoadSaveResultSchema.Type>;
