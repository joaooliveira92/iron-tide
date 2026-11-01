import { Schema } from "effect";
import {
  MAX_COURSE_DEG,
  MAX_SPEED_KNOTS,
  MAX_SPEED_PERCENT,
  MIN_COURSE_DEG,
  MIN_SPEED_KNOTS,
  MIN_SPEED_PERCENT,
  PLAYER_BATTLE_STANCES,
} from "./player-battle-orders.js";
import { nonEmptyString } from "./schema-primitives.js";

const boundedInteger = (minimum: number, maximum: number) =>
  Schema.Finite.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(minimum),
    Schema.isLessThanOrEqualTo(maximum),
  );

export const PlayerBattleDivisionOrderSchema = Schema.Struct({
  divisionId: nonEmptyString,
  stance: Schema.Literals(PLAYER_BATTLE_STANCES),
  speedPercent: boundedInteger(MIN_SPEED_PERCENT, MAX_SPEED_PERCENT),
  courseDeg: Schema.optionalKey(boundedInteger(MIN_COURSE_DEG, MAX_COURSE_DEG)),
  speedKnots: Schema.optionalKey(boundedInteger(MIN_SPEED_KNOTS, MAX_SPEED_KNOTS)),
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
