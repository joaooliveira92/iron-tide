import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const AreaSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  type: Schema.Literals(["land", "sea", "coastal"]),
  controller: Schema.optional(Schema.String),
  provenance: Schema.optional(ProvenanceSchema),
});

export type Area = typeof AreaSchema.Type;
