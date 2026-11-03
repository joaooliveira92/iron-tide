import { BluewaveError } from "@bluewave/contracts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FIXTURE_BATTLE_OFFER_RULES } from "@bluewave/test-support";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { clearCampaignSessionsForTest } from "../campaignSessions.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import type { PlayerBattleSave } from "../playerBattleSidecar.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { ContentArtifact, contentArtifactLayer } from "../runtime/contentArtifact.js";
import { DecisionSource } from "../runtime/decisionSource.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import {
  pendingTurnStoreMemoryLayer,
  PendingTurnStore,
  PlayerBattleStore,
  playerBattleStoreMemoryLayer,
} from "../runtime/turnSidecarStores.js";
import { resolveTurnProgram, submitOfferResponseProgram } from "./resolveTurn.js";
import {
  advancePlayerBattleProgram,
  finishPlayerBattleProgram,
  startPlayerBattleProgram,
} from "./playerBattle.js";
import {
  projectSession,
  projectionFailureReason,
  startPlayerBattle,
} from "./playerBattleSession.js";
import { runTurnTransaction } from "./turnTransaction.js";
import { registerWarSession } from "./warSessionFixture.js";

const withOffers = Layer.effect(
  ContentArtifact,
  Effect.gen(function* () {
    const real = yield* ContentArtifact;
    return { ...real, loadBattleOfferRules: () => Effect.succeed(FIXTURE_BATTLE_OFFER_RULES) };
  }),
).pipe(Layer.provide(contentArtifactLayer()));

const SESSION = "s-battle";

interface StartValue {
  readonly sessionHash: string;
  readonly resumed: boolean;
  readonly lastOrders: readonly { divisionId: string; stance: string; speedPercent: number }[];
  readonly view: {
    readonly minute: number;
    readonly ended: boolean;
    readonly playerNationId: string;
    readonly attackerId: string;
    readonly divisions: readonly { divisionId: string; sideId: string }[];
  };
}

describe("player battle session over in-memory sidecar stores", () => {
  let saveDir: string;

  beforeEach(() => {
    saveDir = mkdtempSync(resolve(tmpdir(), "bw-player-battle-session-"));
  });

  afterEach(() => {
    rmSync(saveDir, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  function app(stores: Layer.Layer<PendingTurnStore | PlayerBattleStore>) {
    const runtime = ManagedRuntime.make(Layer.mergeAll(desktopMainLayer(), withOffers, stores));
    const run = async (program: AnyCommandHandler, payload: unknown) =>
      projectCommandExit(await runtime.runPromiseExit(programFor(program)(payload)));
    return { runtime, run };
  }

  const memoryStores = () =>
    Layer.mergeAll(pendingTurnStoreMemoryLayer(), playerBattleStoreMemoryLayer());

  type App = ReturnType<typeof app>;

  async function acceptedBattle(a: App): Promise<string> {
    registerWarSession(SESSION, join(saveDir, "save"));
    const turn = await a.run(resolveTurnProgram, {
      sessionId: SESSION,
      expectedRevision: 0,
      transportRequestId: "req",
    });
    if (turn.outcome !== "success") throw new Error("resolve failed");
    const offer = (turn.value as { request?: { interruptionId: string; battleId: string } })
      .request;
    if (offer === undefined) throw new Error("no offer");
    const accepted = await a.run(submitOfferResponseProgram, {
      sessionId: SESSION,
      expectedRevision: 0,
      transportRequestId: "req",
      interruptionId: offer.interruptionId,
      battleId: offer.battleId,
      response: "accept",
    });
    if (accepted.outcome !== "success") throw new Error("accept failed");
    return offer.battleId;
  }

  const start = async (a: App, battleId: string): Promise<StartValue> => {
    const result = await a.run(startPlayerBattleProgram, { sessionId: SESSION, battleId });
    if (result.outcome !== "success") throw new Error(`start ${JSON.stringify(result)}`);
    return result.value as StartValue;
  };

  const ordersFor = (value: StartValue, speedPercent: number) => {
    const side = value.view.playerNationId === value.view.attackerId ? "ATTACKER" : "DEFENDER";
    return value.view.divisions
      .filter((division) => division.sideId === side)
      .map((division) => ({
        divisionId: division.divisionId,
        stance: "HOLD" as const,
        speedPercent,
      }));
  };

  const advance = (a: App, battleId: string, mode: "minute" | "to_end", divisions: unknown) =>
    a.run(advancePlayerBattleProgram, { sessionId: SESSION, battleId, mode, divisions });

  const resumeOf = async (a: App, battleId: string) => {
    const outcome = await a.runtime.runPromise(startPlayerBattle({ sessionId: SESSION, battleId }));
    if (outcome.kind !== "started") throw new Error(outcome.reason);
    return outcome.resume;
  };

  it("refuses with the tagged failure's reason when the committed fleets no longer hold the battle's ships", async () => {
    const a = app(memoryStores());
    const battleId = await acceptedBattle(a);

    const refusal = await a.runtime.runPromise(
      Effect.gen(function* () {
        const record = yield* (yield* CampaignSessionStore).get(SESSION);
        const pending = yield* (yield* PendingTurnStore).load(record.saveDir);
        if (pending === null) throw new Error("expected a pending turn");
        const outcome = yield* runTurnTransaction({
          sessionId: SESSION,
          expectedRevision: pending.startingRevision,
          recordedInputs: pending.recordedInputs,
          pendingDecisions: yield* (yield* DecisionSource).pendingDecisions(SESSION),
          allowInterruptions: true,
        });
        if (outcome.kind !== "suspended") throw new Error("expected a suspended turn");
        const emptied = new Map(
          [...outcome.snapshot.nations].map(([id, nation]) => [id, { ...nation, fleets: [] }]),
        );
        return projectSession(
          { ...outcome.snapshot, nations: emptied },
          battleId,
          `${record.campaignSeed}:month:${String(pending.startingRevision)}`,
          pending,
        );
      }),
    );

    expect(refusal).toEqual({
      kind: "refused",
      reason: "PLAYER_BATTLE_PROJECTION_FAILED",
      diagnostics: ["manifest persistent asset not found in either nation's committed ships"],
    });
    await a.runtime.dispose();
  });

  it("starts fresh, advances a minute, fights to the end and finishes", async () => {
    const a = app(memoryStores());
    const battleId = await acceptedBattle(a);
    const started = await start(a, battleId);
    expect(started.resumed).toBe(false);
    expect(started.lastOrders).toEqual([]);
    expect(started.view.minute).toBe(0);

    const minute = await advance(a, battleId, "minute", ordersFor(started, 40));
    expect(minute.outcome).toBe("success");
    expect(minute.outcome === "success" && (minute.value as StartValue).view.minute).toBe(1);

    const early = await a.run(finishPlayerBattleProgram, { sessionId: SESSION, battleId });
    expect(early).toMatchObject({ outcome: "error", reason: "PLAYER_BATTLE_NOT_FINISHED" });

    const toEnd = await advance(a, battleId, "to_end", []);
    expect(toEnd.outcome).toBe("success");
    if (toEnd.outcome !== "success") return;
    expect((toEnd.value as { result: unknown }).result).not.toBeNull();

    const finished = await a.run(finishPlayerBattleProgram, { sessionId: SESSION, battleId });
    expect(finished.outcome).toBe("success");
    const again = await a.run(finishPlayerBattleProgram, { sessionId: SESSION, battleId });
    expect(again).toMatchObject({ outcome: "error", reason: "PLAYER_BATTLE_NOT_STARTED" });
    await a.runtime.dispose();
  });

  it("resumes from the saved steps with the same hash and last orders after a restart", async () => {
    const stores = memoryStores();
    const first = app(stores);
    const battleId = await acceptedBattle(first);
    const started = await start(first, battleId);
    const orders = ordersFor(started, 40);
    await advance(first, battleId, "minute", orders);
    const before = await advance(first, battleId, "minute", orders);
    if (before.outcome !== "success") throw new Error("advance failed");
    const beforeValue = before.value as StartValue;
    await first.runtime.dispose();

    const restarted = app(stores);
    const resumed = await start(restarted, battleId);
    expect(resumed.resumed).toBe(true);
    expect(resumed.view.minute).toBe(2);
    expect(resumed.sessionHash).toBe(beforeValue.sessionHash);
    expect(resumed.lastOrders).toEqual(orders);
    await restarted.runtime.dispose();
  });

  const steered = (value: StartValue, courseDeg: number, speedKnots: number) =>
    ordersFor(value, 100).map((order) => ({
      ...order,
      stance: "ENGAGE" as const,
      courseDeg,
      speedKnots,
    }));

  it("steers a division and resumes the same hash and course orders after a restart", async () => {
    const stores = memoryStores();
    const first = app(stores);
    const battleId = await acceptedBattle(first);
    const started = await start(first, battleId);
    const orders = steered(started, 90, 9);
    await advance(first, battleId, "minute", orders);
    await advance(first, battleId, "minute", orders);
    const before = await advance(first, battleId, "minute", orders);
    if (before.outcome !== "success") throw new Error("advance failed");
    const beforeValue = before.value as StartValue;
    await first.runtime.dispose();

    const restarted = app(stores);
    const resumed = await start(restarted, battleId);
    expect(resumed.resumed).toBe(true);
    expect(resumed.view.minute).toBe(3);
    expect(resumed.sessionHash).toBe(beforeValue.sessionHash);
    expect(resumed.lastOrders).toEqual(orders);
    await restarted.runtime.dispose();
  });

  it("reaches the same hash whether the minutes arrive in one run or across a reload", async () => {
    const straightStores = memoryStores();
    const straight = app(straightStores);
    const battleId = await acceptedBattle(straight);
    const started = await start(straight, battleId);
    const orders = steered(started, 45, 7);
    let last: StartValue | null = null;
    for (let minute = 0; minute < 4; minute += 1) {
      const result = await advance(straight, battleId, "minute", orders);
      if (result.outcome !== "success") throw new Error("advance failed");
      last = result.value as StartValue;
    }
    await straight.runtime.dispose();
    clearCampaignSessionsForTest();

    const splitStores = memoryStores();
    const split = app(splitStores);
    const splitBattleId = await acceptedBattle(split);
    const splitStart = await start(split, splitBattleId);
    expect(splitStart.sessionHash).toBe(started.sessionHash);
    await advance(split, splitBattleId, "minute", orders);
    await advance(split, splitBattleId, "minute", orders);
    await split.runtime.dispose();
    const reloaded = app(splitStores);
    await start(reloaded, splitBattleId);
    await advance(reloaded, splitBattleId, "minute", orders);
    const finalStep = await advance(reloaded, splitBattleId, "minute", orders);
    if (finalStep.outcome !== "success") throw new Error("advance failed");
    expect((finalStep.value as StartValue).sessionHash).toBe(last!.sessionHash);
    await reloaded.runtime.dispose();
  });

  it("fights to the end after a division steers away from the enemy", async () => {
    const a = app(memoryStores());
    const battleId = await acceptedBattle(a);
    const started = await start(a, battleId);
    const [first, ...rest] = ordersFor(started, 100);
    const orders = [
      { ...first!, stance: "ENGAGE" as const, courseDeg: 45, speedKnots: 10 },
      ...rest.map((order) => ({ ...order, stance: "ENGAGE" as const })),
    ];
    for (let minute = 0; minute < 9; minute += 1) {
      const step = await advance(a, battleId, "minute", orders);
      expect(step, JSON.stringify(step)).toMatchObject({ outcome: "success" });
    }
    const toEnd = await advance(a, battleId, "to_end", orders);
    expect(toEnd, JSON.stringify(toEnd)).toMatchObject({ outcome: "success" });
    await a.runtime.dispose();
  });

  it("starts fresh and keeps a corrupt battle save instead of clearing it", async () => {
    const cleared: string[] = [];
    const spy = Layer.effect(
      PlayerBattleStore,
      Effect.gen(function* () {
        const base = yield* PlayerBattleStore;
        return {
          ...base,
          clear: (dir: string) => {
            cleared.push(dir);
            return base.clear(dir);
          },
        };
      }),
    ).pipe(Layer.provide(playerBattleStoreMemoryLayer({ corrupt: true })));
    const a = app(Layer.mergeAll(pendingTurnStoreMemoryLayer(), spy));
    const battleId = await acceptedBattle(a);
    expect(await resumeOf(a, battleId)).toBe("save-corrupt");
    const started = await start(a, battleId);
    expect(started.resumed).toBe(false);
    expect(started.view.minute).toBe(0);
    expect(cleared).toEqual([]);
    await a.runtime.dispose();
  });

  it("starts fresh and clears a save whose steps no longer replay", async () => {
    const stores = memoryStores();
    const a = app(stores);
    const battleId = await acceptedBattle(a);
    const turnId = await a.runtime.runPromise(
      Effect.gen(function* () {
        return (yield* (yield* PendingTurnStore).load(join(saveDir, "save")))!.turnId;
      }),
    );
    const poisoned: PlayerBattleSave = JSON.parse(
      JSON.stringify({
        schemaVersion: "1.0.0",
        turnId,
        battleId,
        steps: [{ mode: "minute", divisions: null }],
      }),
    );
    await a.runtime.runPromise(
      Effect.gen(function* () {
        yield* (yield* PlayerBattleStore).save(join(saveDir, "save"), poisoned);
      }),
    );
    expect(await resumeOf(a, battleId)).toBe("resume-failed");
    const started = await start(a, battleId);
    const stillThere = await a.runtime.runPromise(
      Effect.gen(function* () {
        return yield* (yield* PlayerBattleStore).load(join(saveDir, "save"), { turnId, battleId });
      }),
    );
    expect(started.resumed).toBe(false);
    expect(started.view.minute).toBe(0);
    expect(stillThere.kind).toBe("none");
    await a.runtime.dispose();
  });
});

describe("projection failure reason", () => {
  const reason = "both sides require at least one committed, promotable ship";

  it("reads the reason from a tagged combat failure", () => {
    const failure = new BluewaveError("BATTLE_AUTO_RESOLUTION_FAILED", {
      code: "BATTLE_AUTO_RESOLUTION_FAILED",
      reason,
    });
    expect(projectionFailureReason(failure)).toBe(reason);
  });

  it("falls back to the message for an untagged error and stringifies other values", () => {
    expect(projectionFailureReason(new Error("boom"))).toBe("boom");
    expect(projectionFailureReason("plain")).toBe("plain");
  });
});
