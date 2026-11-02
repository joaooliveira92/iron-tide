import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const AreaSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  type: Schema.Literals(["land", "sea", "coastal"]),
  controller: Schema.optional(Schema.String),
  cessionCost: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)).annotate({
      description:
        "PROVISIONAL war-score cost of demanding this whole area in a peace settlement; absent means the area cannot be ceded",
    }),
  ),
  provenance: Schema.optional(ProvenanceSchema),
});

export type Area = typeof AreaSchema.Type;
