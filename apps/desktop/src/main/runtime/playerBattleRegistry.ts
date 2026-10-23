import type { PlayerBattleSession } from "@bluewave/combat/battleResolution";
import { Context, Effect, Layer } from "effect";
import type { PlayerBattleStep } from "../playerBattleSidecar.js";

export interface LivePlayerBattle {
  readonly session: PlayerBattleSession;
  readonly steps: readonly PlayerBattleStep[];
}

export class PlayerBattleRegistry extends Context.Service<
  PlayerBattleRegistry,
  {
    readonly get: (sessionId: string, battleId: string) => Effect.Effect<LivePlayerBattle | null>;
    readonly put: (
      sessionId: string,
      battleId: string,
      live: LivePlayerBattle,
    ) => Effect.Effect<void>;
    readonly remove: (sessionId: string, battleId: string) => Effect.Effect<void>;
  }
>()("bluewave/desktop/PlayerBattleRegistry") {}

const keyOf = (sessionId: string, battleId: string): string => `${sessionId}::${battleId}`;

export function playerBattleRegistryLayer(): Layer.Layer<PlayerBattleRegistry> {
  return Layer.sync(PlayerBattleRegistry, () => {
    const live = new Map<string, LivePlayerBattle>();
    return {
      get: (sessionId, battleId) => Effect.sync(() => live.get(keyOf(sessionId, battleId)) ?? null),
      put: (sessionId, battleId, value) =>
        Effect.sync(() => void live.set(keyOf(sessionId, battleId), value)),
      remove: (sessionId, battleId) =>
        Effect.sync(() => void live.delete(keyOf(sessionId, battleId))),
    };
  });
}
