import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const PossessionSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  areaId: Schema.NonEmptyString,
  since: Schema.optional(Schema.String),
  provenance: Schema.optional(ProvenanceSchema),
});

export type Possession = typeof PossessionSchema.Type;
