import type { TacticalMinefieldRecord } from "@bluewave/combat/collision";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FIXTURE_BATTLE_OFFER_RULES } from "@bluewave/test-support";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { clearCampaignSessionsForTest } from "../campaignSessions.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { CampaignSessionStore } from "../runtime/campaignSessionStore.js";
import { ContentArtifact, contentArtifactLayer } from "../runtime/contentArtifact.js";
import { DecisionSource } from "../runtime/decisionSource.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { PlayerBattleRegistry } from "../runtime/playerBattleRegistry.js";
import {
  pendingTurnStoreMemoryLayer,
  PendingTurnStore,
  playerBattleStoreMemoryLayer,
} from "../runtime/turnSidecarStores.js";
import { startPlayerBattleProgram } from "./playerBattle.js";
import { projectSession } from "./playerBattleSession.js";
import { resolveTurnProgram, submitOfferResponseProgram } from "./resolveTurn.js";
import { runTurnTransaction } from "./turnTransaction.js";
import { registerWarSession } from "./warSessionFixture.js";

const SESSION = "s-minefields";

const fieldFor = (knownToSideIds: readonly string[]): TacticalMinefieldRecord => ({
  id: "mf-1",
  xM: 1_200,
  yM: -300,
  radiusM: 150,
  knownToSideIds,
  pressureBp: 9_000,
});

describe("tactical minefields supplied from the desktop", () => {
  let saveDir: string;
  let supplied: Readonly<Record<string, readonly TacticalMinefieldRecord[]>> | undefined;

  beforeEach(() => {
    saveDir = mkdtempSync(resolve(tmpdir(), "bw-player-battle-minefields-"));
    supplied = undefined;
  });

  afterEach(() => {
    rmSync(saveDir, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  const withMinefields = Layer.effect(
    ContentArtifact,
    Effect.gen(function* () {
      const real = yield* ContentArtifact;
      return {
        ...real,
        loadBattleOfferRules: () => Effect.succeed(FIXTURE_BATTLE_OFFER_RULES),
        loadBattleMinefields: () => Effect.succeed(supplied),
      };
    }),
  ).pipe(Layer.provide(contentArtifactLayer()));

  function app() {
    const runtime = ManagedRuntime.make(
      Layer.mergeAll(
        desktopMainLayer(),
        withMinefields,
        pendingTurnStoreMemoryLayer(),
        playerBattleStoreMemoryLayer(),
      ),
    );
    const run = async (program: AnyCommandHandler, payload: unknown) =>
      projectCommandExit(await runtime.runPromiseExit(programFor(program)(payload)));
    return { runtime, run };
  }

  async function acceptedBattle(a: ReturnType<typeof app>): Promise<string> {
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

  const suspendedSnapshot = (a: ReturnType<typeof app>) =>
    a.runtime.runPromise(
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
        return { record, pending, snapshot: outcome.snapshot };
      }),
    );

  it("loads no minefields from the shipped content", async () => {
    const a = app();
    const loaded = await a.runtime.runPromise(
      Effect.gen(function* () {
        return yield* (yield* ContentArtifact).loadBattleMinefields();
      }).pipe(Effect.provide(contentArtifactLayer())),
    );
    expect(loaded).toBeUndefined();
    await a.runtime.dispose();
  });

  it("projects only the fields a side knows into the started battle's collision context", async () => {
    const a = app();
    const battleId = await acceptedBattle(a);
    const { snapshot } = await suspendedSnapshot(a);
    const manifest = (snapshot.wars.battleManifests ?? []).find(
      (candidate) => candidate.battleId === battleId,
    );
    if (manifest === undefined) throw new Error("expected a manifest");
    const [knowing] = manifest.sides.map((side) => side.sideId);
    if (knowing === undefined) throw new Error("expected a side");
    supplied = { [manifest.areaId]: [fieldFor([knowing])] };

    const started = await a.run(startPlayerBattleProgram, { sessionId: SESSION, battleId });
    if (started.outcome !== "success") throw new Error(`start ${JSON.stringify(started)}`);
    const live = await a.runtime.runPromise(
      Effect.gen(function* () {
        return yield* (yield* PlayerBattleRegistry).get(SESSION, battleId);
      }),
    );
    const bySide = live?.session.collision?.minefields;
    expect(bySide).toEqual({
      [knowing]: { minefields: [{ id: "mf-1", xM: 1_200, yM: -300, radiusM: 150 }] },
    });
    expect(JSON.stringify(bySide)).not.toContain("9000");
    await a.runtime.dispose();
  });

  it("leaves the collision context without minefields when none are supplied for the area", async () => {
    const a = app();
    const battleId = await acceptedBattle(a);
    supplied = { "some-other-area": [fieldFor(["ATTACKER"])] };
    await a.run(startPlayerBattleProgram, { sessionId: SESSION, battleId });
    const live = await a.runtime.runPromise(
      Effect.gen(function* () {
        return yield* (yield* PlayerBattleRegistry).get(SESSION, battleId);
      }),
    );
    expect(live?.session.collision?.minefields).toBeUndefined();
    await a.runtime.dispose();
  });

  it("projectSession carries minefields by area into the session", async () => {
    const a = app();
    const battleId = await acceptedBattle(a);
    const { record, pending, snapshot } = await suspendedSnapshot(a);
    const manifest = (snapshot.wars.battleManifests ?? []).find(
      (candidate) => candidate.battleId === battleId,
    );
    if (manifest === undefined) throw new Error("expected a manifest");
    const sideIds = manifest.sides.map((side) => side.sideId);
    const projected = projectSession(
      snapshot,
      battleId,
      `${record.campaignSeed}:month:${String(pending.startingRevision)}`,
      pending,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { [manifest.areaId]: [fieldFor(sideIds)] },
    );
    if ("kind" in projected) throw new Error(projected.reason);
    expect(Object.keys(projected.collision?.minefields ?? {}).sort()).toEqual([...sideIds].sort());
    await a.runtime.dispose();
  });
});
