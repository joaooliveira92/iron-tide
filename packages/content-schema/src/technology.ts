import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

export const TechPrerequisiteSchema = Schema.Struct({
  techId: Schema.NonEmptyString,
});

export const TechnologyPrerequisiteChainSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  category: Schema.NonEmptyString,
  researchFieldId: Schema.optional(Schema.NonEmptyString),
  prerequisites: Schema.optional(Schema.Array(TechPrerequisiteSchema)),
  cost: Schema.optional(Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0))),
  discoveryWeight: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1_000_000 })),
  ),
  availabilityMonth: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  ),
  year: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1880, maximum: 1970 })),
  ),
  provenance: Schema.optional(ProvenanceSchema),
});

export type TechnologyPrerequisite = typeof TechnologyPrerequisiteChainSchema.Type;
