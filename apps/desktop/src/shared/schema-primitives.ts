import { Schema } from "effect";

export const nonEmptyString = Schema.String.check(Schema.isMinLength(1));

export const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

export const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));

export const int = Schema.Finite.check(Schema.isInt());

export const boundedString = (min: number, max: number) =>
  Schema.String.check(Schema.isMinLength(min), Schema.isMaxLength(max));
