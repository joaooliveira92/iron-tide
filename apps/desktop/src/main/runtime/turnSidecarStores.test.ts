import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { buildPendingTurn } from "../pendingTurn.js";
import { PLAYER_BATTLE_FILENAME, type PlayerBattleSave } from "../playerBattleSidecar.js";
import {
  PendingTurnStore,
  PlayerBattleStore,
  pendingTurnStoreLayer,
  pendingTurnStoreMemoryLayer,
  playerBattleStoreLayer,
  playerBattleStoreMemoryLayer,
} from "./turnSidecarStores.js";

const record = buildPendingTurn({
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
});

const save: PlayerBattleSave = {
  schemaVersion: "1.0.0",
  turnId: "turn-1",
  battleId: "battle-1",
  steps: [
    { mode: "minute", divisions: [{ divisionId: "d1", stance: "ENGAGE", speedPercent: 50 }] },
  ],
};
const expected = { turnId: "turn-1", battleId: "battle-1" };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "turn-sidecars-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const adapters = [
  ["filesystem", () => Layer.merge(pendingTurnStoreLayer(), playerBattleStoreLayer())],
  ["in-memory", () => Layer.merge(pendingTurnStoreMemoryLayer(), playerBattleStoreMemoryLayer())],
] as const;

describe.each(adapters)("%s turn sidecar stores", (_name, makeLayer) => {
  const run = <A, E>(effect: Effect.Effect<A, E, PendingTurnStore | PlayerBattleStore>) =>
    Effect.runPromise(effect.pipe(Effect.provide(makeLayer())));

  it("round-trips and clears the pending turn", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* PendingTurnStore;
        const before = yield* store.load(dir);
        yield* store.save(dir, record);
        const saved = yield* store.load(dir);
        yield* store.clear(dir);
        return { before, saved, after: yield* store.load(dir) };
      }),
    );
    expect(result).toEqual({ before: null, saved: record, after: null });
  });

  it("round-trips a player battle save only for the expected turn and battle", async () => {
    const result = await run(
      Effect.gen(function* () {
        const store = yield* PlayerBattleStore;
        const before = yield* store.load(dir, expected);
        yield* store.save(dir, save);
        return {
          before,
          found: yield* store.load(dir, expected),
          otherBattle: yield* store.load(dir, { ...expected, battleId: "battle-2" }),
          otherTurn: yield* store.load(dir, { ...expected, turnId: "turn-2" }),
        };
      }),
    );
    expect(result.before).toEqual({ kind: "none" });
    expect(result.found).toEqual({ kind: "found", save });
    expect(result.otherBattle).toEqual({ kind: "none" });
    expect(result.otherTurn).toEqual({ kind: "none" });
  });

  it("forgets a cleared player battle save", async () => {
    const after = await run(
      Effect.gen(function* () {
        const store = yield* PlayerBattleStore;
        yield* store.save(dir, save);
        yield* store.clear(dir);
        return yield* store.load(dir, expected);
      }),
    );
    expect(after).toEqual({ kind: "none" });
  });
});

describe("filesystem turn sidecar stores", () => {
  it("distinguishes a corrupt player battle save from a missing one", async () => {
    writeFileSync(join(dir, PLAYER_BATTLE_FILENAME), "{broken", "utf8");
    const load = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* PlayerBattleStore).load(dir, expected);
      }).pipe(Effect.provide(playerBattleStoreLayer())),
    );
    expect(load).toEqual({ kind: "corrupt" });
  });

  it("fails with a tagged CommandFailed when the save directory is unwritable", async () => {
    const failure = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* PendingTurnStore).save(join(dir, "missing"), record);
      }).pipe(
        Effect.provide(pendingTurnStoreLayer()),
        Effect.catchTag("CommandFailed", (error) => Effect.succeed(error.reason)),
      ),
    );
    expect(failure).toBe("PENDING_TURN_WRITE_FAILED");
  });
});
