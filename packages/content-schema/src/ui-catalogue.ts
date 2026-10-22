import { Schema } from "effect";

export const UiCatalogueSchema = Schema.Struct({
  locale: Schema.NonEmptyString,
  strings: Schema.Record(Schema.String, Schema.String),
});

export type UiCatalogue = typeof UiCatalogueSchema.Type;
