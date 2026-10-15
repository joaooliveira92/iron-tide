import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const RouteEdgeSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  from: Schema.NonEmptyString,
  to: Schema.NonEmptyString,
  type: Schema.Literals(["land", "sea", "rail"]),
  distance: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0)),
  provenance: Schema.optional(ProvenanceSchema),
});

export type RouteEdge = typeof RouteEdgeSchema.Type;
