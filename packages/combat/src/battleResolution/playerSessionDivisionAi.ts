import { BluewaveError } from "@bluewave/contracts";
import { Schema } from "effect";
import {
  DivisionAiMemorySchema,
  decodeDivisionAiMemory,
  hashDivisionAiMemory,
  type DivisionAiMemory,
} from "../division-ai/memory.js";
import { decodeContract } from "../schema-issues.js";
import type { PlayerBattleSession } from "./playerSessionTypes.js";
import { PLAYER_BATTLE_DIVISION_AI_CHECKPOINT_INVALID } from "./reasonCodes.js";

export interface PlayerBattleDivisionAiCheckpoint {
  readonly minute: number;
  readonly memoryHash: string;
  readonly memory: DivisionAiMemory;
}

export const PlayerBattleDivisionAiCheckpointSchema = Schema.Struct({
  minute: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
  memoryHash: Schema.String.check(Schema.isMinLength(1)),
  memory: DivisionAiMemorySchema,
});

export function withDivisionAiMemory(
  session: PlayerBattleSession,
  memory: DivisionAiMemory,
): PlayerBattleSession {
  return { ...session, divisionAi: { memory } };
}

export function divisionAiCheckpointOf(
  session: PlayerBattleSession,
): PlayerBattleDivisionAiCheckpoint | null {
  if (session.divisionAi === undefined) return null;
  const { memory } = session.divisionAi;
  return { minute: session.minute, memoryHash: hashDivisionAiMemory(memory), memory };
}

function invalid(reason: string, field: string): BluewaveError {
  return new BluewaveError(PLAYER_BATTLE_DIVISION_AI_CHECKPOINT_INVALID, {
    code: PLAYER_BATTLE_DIVISION_AI_CHECKPOINT_INVALID,
    field,
    reason,
  });
}

export function restoreDivisionAiCheckpoint(
  session: PlayerBattleSession,
  stored: unknown,
): PlayerBattleSession {
  if (stored === null) return session;
  const checkpoint = decodeContract(
    PlayerBattleDivisionAiCheckpointSchema,
    PLAYER_BATTLE_DIVISION_AI_CHECKPOINT_INVALID,
    stored,
  );
  const memory = decodeDivisionAiMemory(checkpoint.memory);
  if (checkpoint.minute !== session.minute) {
    throw invalid(
      `checkpoint minute ${String(checkpoint.minute)} does not match session minute ${String(session.minute)}`,
      "minute",
    );
  }
  if (hashDivisionAiMemory(memory) !== checkpoint.memoryHash) {
    throw invalid("memory does not match its recorded hash", "memoryHash");
  }
  return withDivisionAiMemory(session, memory);
}
