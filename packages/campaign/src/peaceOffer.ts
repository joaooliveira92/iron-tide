import { Schema } from "effect";

export const PeaceOfferTermSchema = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("StatusQuo") }),
  Schema.Struct({ _tag: Schema.Literal("CedeArea"), areaId: Schema.NonEmptyString }),
]);

export const PeaceOfferSchema = Schema.Struct({
  warId: Schema.NonEmptyString,
  proposerId: Schema.NonEmptyString,
  targetId: Schema.NonEmptyString,
  month: Schema.String.check(Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/)),
  term: PeaceOfferTermSchema,
  reasonCode: Schema.NonEmptyString,
});

export type PeaceOffer = typeof PeaceOfferSchema.Type;
