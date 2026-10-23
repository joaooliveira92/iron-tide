import { Schema } from "effect";
import {
  MAX_SPEED_PERCENT,
  MIN_SPEED_PERCENT,
  PLAYER_BATTLE_STANCES,
} from "./player-battle-orders.js";
import { nonEmptyString } from "./schema-primitives.js";

export const PlayerBattleDivisionOrderSchema = Schema.Struct({
  divisionId: nonEmptyString,
  stance: Schema.Literals(PLAYER_BATTLE_STANCES),
  speedPercent: Schema.Finite.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(MIN_SPEED_PERCENT),
    Schema.isLessThanOrEqualTo(MAX_SPEED_PERCENT),
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
