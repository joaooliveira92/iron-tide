import { Schema } from "effect";

import {
  CONFIDENCE_LEVELS_SCHEMA,
  PROVENANCE_KINDS_SCHEMA,
  SOURCE_STATUSES_SCHEMA,
} from "./naval-profile-vocab.js";

const int = Schema.Finite.check(Schema.isInt());

export const SourceReferenceSchema = Schema.Struct({
  sourceId: Schema.optional(Schema.String),
  title: Schema.NonEmptyString,
  author: Schema.optional(Schema.String),
  year: Schema.optional(int),
  page: Schema.optional(Schema.String),
  section: Schema.optional(Schema.String),
  archiveOrUrl: Schema.optional(Schema.String),
  accessedAt: Schema.optional(Schema.String),
});

export const DerivationSchema = Schema.Struct({
  sourceValue: Schema.String,
  sourceUnit: Schema.String,
  conversion: Schema.String,
  gameValue: Schema.String,
  roundingRule: Schema.optional(Schema.String),
  originalValue: Schema.optional(Schema.String),
  originalUnit: Schema.optional(Schema.String),
  convertedValue: Schema.optional(Schema.String),
  convertedUnit: Schema.optional(Schema.String),
});

export const ProvenanceSchema = Schema.Struct({
  sourceStatus: SOURCE_STATUSES_SCHEMA,
  confidence: CONFIDENCE_LEVELS_SCHEMA,
  kind: PROVENANCE_KINDS_SCHEMA,
  sources: Schema.Array(SourceReferenceSchema),
  derivation: Schema.optional(DerivationSchema),
  note: Schema.optional(Schema.String),
});

export type Provenance = typeof ProvenanceSchema.Type;
