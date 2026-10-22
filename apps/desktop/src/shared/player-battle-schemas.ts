import { Schema } from "effect";
import { nonEmptyString } from "./schema-primitives.js";

export const PlayerBattleDivisionOrderSchema = Schema.Struct({
  divisionId: nonEmptyString,
  stance: Schema.Literals(["ENGAGE", "HOLD", "WITHDRAW"]),
  speedPercent: Schema.Finite.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(100),
  ),
});

export const StartPlayerBattlePayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  battleId: nonEmptyString,
});

export const AdvancePlayerBattlePayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  battleId: nonEmptyString,
  mode: Schema.Literals(["minute", "to_end"]),
  divisions: Schema.Array(PlayerBattleDivisionOrderSchema),
});

export const FinishPlayerBattlePayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  battleId: nonEmptyString,
});
