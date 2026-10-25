import { Schema } from "effect";

import { GATE_REASON_TAGS } from "./eligibility.js";

export const BattleAbsenceSchema = Schema.Struct({
  shipId: Schema.NonEmptyString,
  reasons: Schema.Array(Schema.Literals(GATE_REASON_TAGS)).check(Schema.isMinLength(1)),
});

export type BattleAbsence = typeof BattleAbsenceSchema.Type;
