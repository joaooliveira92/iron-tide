import { Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { buildPendingTurn } from "../pendingTurn.js";
import type { CampaignSessionRecord } from "../campaignSessions.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import {
  CampaignSessionStore,
  campaignSessionStoreLayer,
} from "../runtime/campaignSessionStore.js";
import {
  PendingTurnStore,
  pendingTurnStoreMemoryLayer,
  playerBattleStoreMemoryLayer,
} from "../runtime/turnSidecarStores.js";
import {
  advancePlayerBattleProgram,
  finishPlayerBattleProgram,
  startPlayerBattleProgram,
} from "./playerBattle.js";

const saveDir = "/virtual/save";
const record = { sessionId: "s", saveDir } as CampaignSessionRecord;
const sessionLayer = Layer.effect(
  CampaignSessionStore,
  Effect.gen(function* () {
    const base = yield* CampaignSessionStore;
    return { ...base, get: () => Effect.succeed(record) };
  }),
).pipe(Layer.provide(campaignSessionStoreLayer()));

const pending = (outstanding?: { subjectKey: string }) =>
  buildPendingTurn({
    projectionVersion: "1.0.0",
    turnId: "turn-1",
    campaignId: "c",
    playerNationId: "uk",
    startingRevision: 0,
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
    contentHashes: { shipBuilding: "s", armament: "a", contentArtifact: "c" },
    committedOrderHash: "h",
    recordedInputs: [],
    nextInterruptionOrdinal: 0,
    createdAt: "1880-01",
    ...(outstanding === undefined
      ? {}
      : {
          outstanding: {
            kind: "battle" as const,
            phase: "BATTLE_RESOLUTION" as never,
            ordinal: 0,
            subjectKey: outstanding.subjectKey,
          },
        }),
  });

const layer = () =>
  Layer.mergeAll(
    desktopMainLayer(),
    sessionLayer,
    pendingTurnStoreMemoryLayer(),
    playerBattleStoreMemoryLayer(),
  );

describe("player battle handlers over the sidecar stores", () => {
  it("startPlayerBattle reports NO_PENDING_TURN when the store is empty", async () => {
    const result = await Effect.runPromise(
      startPlayerBattleProgram({ sessionId: "s", battleId: "b1" } as never).pipe(
        Effect.provide(layer()),
      ),
    );
    expect(result).toMatchObject({ outcome: "error", reason: "NO_PENDING_TURN" });
  });

  it("startPlayerBattle reports NO_OUTSTANDING_BATTLE for another battle", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* (yield* PendingTurnStore).save(saveDir, pending({ subjectKey: "other" }));
        return yield* startPlayerBattleProgram({ sessionId: "s", battleId: "b1" } as never);
      }).pipe(Effect.provide(layer())),
    );
    expect(result).toMatchObject({ outcome: "error", reason: "NO_OUTSTANDING_BATTLE" });
  });

  it("advance and finish require a started battle", async () => {
    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const advance = yield* advancePlayerBattleProgram({
          sessionId: "s",
          battleId: "unstarted",
          mode: "minute",
          divisions: [],
        } as never);
        const finish = yield* finishPlayerBattleProgram({
          sessionId: "s",
          battleId: "unstarted",
        } as never);
        return [advance, finish];
      }).pipe(Effect.provide(layer())),
    );
    expect(results.map((r) => (r.outcome === "error" ? r.reason : undefined))).toEqual([
      "PLAYER_BATTLE_NOT_STARTED",
      "PLAYER_BATTLE_NOT_STARTED",
    ]);
  });
});
