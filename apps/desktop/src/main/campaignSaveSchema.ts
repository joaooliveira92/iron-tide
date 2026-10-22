import { Schema } from "effect";

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

type Mutable<T> =
  T extends ReadonlyArray<infer U>
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

export type LoadSaveResult = Mutable<typeof LoadSaveResultSchema.Type>;
