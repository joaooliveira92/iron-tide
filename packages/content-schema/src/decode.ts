import { Schema } from "effect";

export const CONTENT_DECODE_OPTIONS = { onExcessProperty: "error" } as const;

export type ContentSchema<T = unknown> = Schema.ConstraintDecoder<T, never>;

export function decodeStrict<A>(schema: ContentSchema<A>, data: unknown): A {
  return Schema.decodeUnknownSync(schema, CONTENT_DECODE_OPTIONS)(data);
}

export function decodeStrictResult<A>(schema: ContentSchema<A>, data: unknown) {
  return Schema.decodeUnknownResult(schema, CONTENT_DECODE_OPTIONS)(data);
}
