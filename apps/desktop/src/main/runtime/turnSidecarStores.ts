import { Context, Effect, Layer } from "effect";
import {
  clearPendingTurn,
  loadPendingTurn,
  savePendingTurn,
  type PendingTurnRecord,
} from "../pendingTurn.js";
import {
  clearPlayerBattleSave,
  inspectPlayerBattleSave,
  savePlayerBattle,
  type PlayerBattleExpectation,
  type PlayerBattleSave,
} from "../playerBattleSidecar.js";
import { CommandFailed } from "./commandError.js";

function failure(reason: string, error: unknown): CommandFailed {
  return new CommandFailed({
    reason,
    diagnostics: [error instanceof Error ? error.message : String(error)],
  });
}

function attempt<A>(reason: string, run: () => A): Effect.Effect<A, CommandFailed> {
  return Effect.try({ try: run, catch: (e) => failure(reason, e) });
}

export type PlayerBattleLoad =
  | { readonly kind: "none" }
  | { readonly kind: "corrupt" }
  | { readonly kind: "found"; readonly save: PlayerBattleSave };

export class PendingTurnStore extends Context.Service<
  PendingTurnStore,
  {
    readonly load: (saveDir: string) => Effect.Effect<PendingTurnRecord | null>;
    readonly save: (
      saveDir: string,
      record: PendingTurnRecord,
    ) => Effect.Effect<void, CommandFailed>;
    readonly clear: (saveDir: string) => Effect.Effect<void, CommandFailed>;
  }
>()("bluewave/desktop/PendingTurnStore") {}

export class PlayerBattleStore extends Context.Service<
  PlayerBattleStore,
  {
    readonly load: (
      saveDir: string,
      expected: PlayerBattleExpectation,
    ) => Effect.Effect<PlayerBattleLoad>;
    readonly save: (saveDir: string, save: PlayerBattleSave) => Effect.Effect<void, CommandFailed>;
    readonly clear: (saveDir: string) => Effect.Effect<void, CommandFailed>;
  }
>()("bluewave/desktop/PlayerBattleStore") {}

export function pendingTurnStoreLayer(): Layer.Layer<PendingTurnStore> {
  return Layer.succeed(PendingTurnStore, {
    load: (saveDir) => Effect.sync(() => loadPendingTurn(saveDir)),
    save: (saveDir, record) =>
      attempt("PENDING_TURN_WRITE_FAILED", () => savePendingTurn(saveDir, record)),
    clear: (saveDir) => attempt("PENDING_TURN_CLEAR_FAILED", () => clearPendingTurn(saveDir)),
  });
}

export function playerBattleStoreLayer(): Layer.Layer<PlayerBattleStore> {
  return Layer.succeed(PlayerBattleStore, {
    load: (saveDir, expected) =>
      Effect.sync((): PlayerBattleLoad => {
        const reading = inspectPlayerBattleSave(saveDir, expected);
        if (reading.kind === "corrupt") return { kind: "corrupt" };
        if (reading.kind === "missing" || reading.value === null) return { kind: "none" };
        return { kind: "found", save: reading.value };
      }),
    save: (saveDir, save) =>
      attempt("PLAYER_BATTLE_WRITE_FAILED", () => savePlayerBattle(saveDir, save)),
    clear: (saveDir) => attempt("PLAYER_BATTLE_CLEAR_FAILED", () => clearPlayerBattleSave(saveDir)),
  });
}

export function pendingTurnStoreMemoryLayer(): Layer.Layer<PendingTurnStore> {
  const records = new Map<string, PendingTurnRecord>();
  return Layer.succeed(PendingTurnStore, {
    load: (saveDir) => Effect.sync(() => records.get(saveDir) ?? null),
    save: (saveDir, record) => Effect.sync(() => void records.set(saveDir, record)),
    clear: (saveDir) => Effect.sync(() => void records.delete(saveDir)),
  });
}

export function playerBattleStoreMemoryLayer(): Layer.Layer<PlayerBattleStore> {
  const saves = new Map<string, PlayerBattleSave>();
  return Layer.succeed(PlayerBattleStore, {
    load: (saveDir, expected) =>
      Effect.sync((): PlayerBattleLoad => {
        const save = saves.get(saveDir);
        return save !== undefined &&
          save.turnId === expected.turnId &&
          save.battleId === expected.battleId
          ? { kind: "found", save }
          : { kind: "none" };
      }),
    save: (saveDir, save) => Effect.sync(() => void saves.set(saveDir, save)),
    clear: (saveDir) => Effect.sync(() => void saves.delete(saveDir)),
  });
}
