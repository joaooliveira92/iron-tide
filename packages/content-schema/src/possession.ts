import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const COLONY_VALUE_BP_MAX = 1_000;

export const PossessionSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  areaId: Schema.NonEmptyString,
  since: Schema.optional(Schema.String),
  colonyValueBp: Schema.optional(
    Schema.Finite.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: COLONY_VALUE_BP_MAX }),
    ),
  ),
  provenance: Schema.optional(ProvenanceSchema),
}).check(
  Schema.makeFilter((possession) =>
    possession.colonyValueBp === undefined || possession.provenance !== undefined
      ? undefined
      : "colonyValueBp requires provenance",
  ),
);

export type Possession = typeof PossessionSchema.Type;
