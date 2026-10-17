import { Schema } from "effect";

/**
 * A compiled UI-string catalogue: a UI language plus its stable-key → text
 * strings. Carries no engine state and never feeds back into simulation
 * (ADR-0209). The renderer resolves message keys against it; the projection
 * package stores keys only.
 */
export const UiCatalogueSchema = Schema.Struct({
  locale: Schema.NonEmptyString,
  strings: Schema.Record(Schema.String, Schema.String),
});

export type UiCatalogue = typeof UiCatalogueSchema.Type;
