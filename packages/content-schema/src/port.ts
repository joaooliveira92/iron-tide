import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const PortSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  areaId: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  level: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 10 })),
  ),
  provenance: Schema.optional(ProvenanceSchema),
});

export type Port = typeof PortSchema.Type;
