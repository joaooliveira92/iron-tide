import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

/** The highest port level (`level` is 1..PORT_LEVEL_MAX); S-5 base-limit tables carry one entry per level. */
export const PORT_LEVEL_MAX = 10;

export const PortSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  areaId: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  level: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: PORT_LEVEL_MAX })),
  ),
  provenance: Schema.optional(ProvenanceSchema),
});

export type Port = typeof PortSchema.Type;
