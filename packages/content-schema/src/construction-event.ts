import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

const month = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "must be YYYY-MM" }),
);
const int = Schema.Finite.check(Schema.isInt());
const basisPoints = int.check(Schema.isBetween({ minimum: 1, maximum: 10_000 }));
const identifier = Schema.NonEmptyString.check(Schema.isPattern(/^[a-z][a-z0-9_]*$/));
const reasonCode = Schema.NonEmptyString.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/));

export const CONSTRUCTION_EVENT_KINDS = ["DELAY"] as const;
export const ConstructionEventKindSchema = Schema.Literals(CONSTRUCTION_EVENT_KINDS);
export type ConstructionEventKind = typeof ConstructionEventKindSchema.Type;

export const ConstructionEventEraWindowSchema = Schema.Struct({
  fromMonth: month,
  toMonth: month,
}).check(
  Schema.makeFilter((window) =>
    window.fromMonth <= window.toMonth ? undefined : "fromMonth must not be after toMonth",
  ),
);

export const ConstructionEventSchema = Schema.Struct({
  id: identifier,
  kind: ConstructionEventKindSchema,
  probabilityBp: basisPoints,
  reasonCode,
  causeKey: Schema.NonEmptyString,
  eraWindow: Schema.optional(ConstructionEventEraWindowSchema),
  provenance: ProvenanceSchema,
});
export type ConstructionEvent = typeof ConstructionEventSchema.Type;
