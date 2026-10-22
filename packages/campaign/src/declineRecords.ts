import { Schema } from "effect";

export const DeclinedBattleRecordSchema = Schema.Struct({
  battleId: Schema.NonEmptyString,
  warId: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  areaId: Schema.NonEmptyString,
  month: Schema.NonEmptyString,
  missionType: Schema.NonEmptyString,
  responseInputHash: Schema.NonEmptyString,
  victoryPointCost: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  opponentCredit: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
});

export type DeclinedBattleRecord = typeof DeclinedBattleRecordSchema.Type;

export const DeclineCounterEntrySchema = Schema.Struct({
  key: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  lastWarId: Schema.NonEmptyString,
  count: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  decayAnchorMonth: Schema.String.check(Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/)),
});

export type DeclineCounterEntry = typeof DeclineCounterEntrySchema.Type;
