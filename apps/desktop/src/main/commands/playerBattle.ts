import type { BridgeResult } from "../../shared/bridge-contract.js";
import { Effect } from "effect";
import type { CommandHandler } from "../runtime/commandProgram.js";
import {
  finishPlayerBattle,
  startPlayerBattle,
  stepPlayerBattle,
  type PlayerBattleRefusal,
} from "./playerBattleSession.js";

const failed = (refusal: PlayerBattleRefusal) =>
  ({
    outcome: "error" as const,
    reason: refusal.reason,
    diagnostics: [...refusal.diagnostics],
  }) satisfies BridgeResult<never>;

const succeeded = <Value>(value: Value) =>
  ({
    outcome: "success" as const,
    value,
    diagnostics: [] as string[],
  }) satisfies BridgeResult<Value>;

export const startPlayerBattleProgram: CommandHandler<"startPlayerBattle"> = (payload) =>
  startPlayerBattle(payload).pipe(
    Effect.map((outcome) =>
      outcome.kind === "started" ? succeeded(outcome.value) : failed(outcome),
    ),
  );

export const advancePlayerBattleProgram: CommandHandler<"advancePlayerBattle"> = (payload) =>
  stepPlayerBattle({
    sessionId: payload.sessionId,
    battleId: payload.battleId,
    step: { mode: payload.mode, divisions: payload.divisions },
  }).pipe(
    Effect.map((outcome) =>
      outcome.kind === "stepped" ? succeeded(outcome.value) : failed(outcome),
    ),
  );

export const finishPlayerBattleProgram: CommandHandler<"finishPlayerBattle"> = (payload) =>
  finishPlayerBattle(payload).pipe(
    Effect.map((outcome) =>
      outcome.kind === "finished" ? succeeded(outcome.value) : failed(outcome),
    ),
  );
