import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

const month = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "must be YYYY-MM" }),
);
const int = Schema.Finite.check(Schema.isInt());
const basisPoints = int.check(Schema.isBetween({ minimum: 1, maximum: 10_000 }));
const identifier = Schema.NonEmptyString.check(Schema.isPattern(/^[a-z][a-z0-9_]*$/));
const reasonCode = Schema.NonEmptyString.check(Schema.isPattern(/^[A-Z][A-Z0-9_]*$/));

export const CONSTRUCTION_EVENT_KINDS = ["DELAY", "OVERRUN"] as const;
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

const commonFields = {
  id: identifier,
  probabilityBp: basisPoints,
  reasonCode,
  causeKey: Schema.NonEmptyString,
  eraWindow: Schema.optional(ConstructionEventEraWindowSchema),
  provenance: ProvenanceSchema,
};

export const ConstructionDelayEventSchema = Schema.Struct({
  ...commonFields,
  kind: Schema.Literal("DELAY"),
});

export const ConstructionOverrunEventSchema = Schema.Struct({
  ...commonFields,
  kind: Schema.Literal("OVERRUN"),
  minBp: basisPoints,
  maxBp: basisPoints,
  capBp: basisPoints,
}).check(
  Schema.makeFilter((rule) => {
    if (rule.minBp > rule.maxBp) return "minBp must not be above maxBp";
    if (rule.maxBp > rule.capBp) return "maxBp must not be above capBp";
    return undefined;
  }),
);

export const ConstructionEventSchema = Schema.Union([
  ConstructionDelayEventSchema,
  ConstructionOverrunEventSchema,
]);
export type ConstructionEvent = typeof ConstructionEventSchema.Type;
export type ConstructionOverrunEvent = typeof ConstructionOverrunEventSchema.Type;
