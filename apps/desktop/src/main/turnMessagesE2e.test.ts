import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BattleInstance, CampaignState } from "@bluewave/campaign";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { computeInterruptionId, makeRecordedInput, type PendingDecision } from "@bluewave/messages";
import { SaveStore } from "@bluewave/persistence";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../shared/bridge-contract.js";
import type {
  ReadPendingTurnResult,
  ReadTurnSummariesResult,
  ResolveTurnResult,
} from "../shared/turn-message-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
  removeCampaignSession,
} from "./campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "./compiler.js";
import {
  answerDecisionProgram,
  readPendingTurnProgram,
  resolveTurnProgram,
  submitBattleResultProgram,
} from "./commands/resolveTurn.js";
import { runTurnTransaction } from "./commands/turnTransaction.js";
import { PENDING_TURN_FILENAME } from "./pendingTurn.js";
import { projectCommandExit } from "./runtime/bridgeResult.js";
import { programFor, type AnyCommandHandler } from "./commandProgramFixtures.js";
import { DecisionSource } from "./runtime/decisionSource.js";
import { ContentArtifact, contentArtifactLayer } from "./runtime/contentArtifact.js";
import { desktopMainLayer } from "./runtime/desktopMainLayer.js";
import { toSaveableState } from "./saveHelpers.js";
import { TURN_SUMMARIES_FILENAME, readTurnSummariesProgram } from "./turnSummaries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

const runtime = ManagedRuntime.make(desktopMainLayer());

async function runProgram(
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<unknown>> {
  return projectCommandExit(await runtime.runPromiseExit(programFor(program)(payload)));
}

describe("turn-messages end-to-end acceptance", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-turn-messages-e2e-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  function registerProductionSession(sessionId: string, saveDir: string) {
    const signal = new AbortController().signal;
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(GENERATED_ARTIFACT, signal, collector);
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");
    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveDir);
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "e2e-seed-0123456789abcdef0123456789",
      month: { month: 1, year: 1880 },
      state,
    });
  }

  const resolveTurn = (sessionId: string, expectedRevision: number) =>
    runProgram(resolveTurnProgram, {
      sessionId,
      expectedRevision,
      transportRequestId: `req-${String(expectedRevision)}`,
    }) as Promise<BridgeResult<ResolveTurnResult>>;

  const TEST_DECISION: PendingDecision = {
    phase: "appropriation",
    subjectKey: "uk",
    decisionId: "test-decision",
    titleKey: "messages.decision.title",
    bodyKey: "messages.decision.body",
    interpolation: {},
    options: [
      {
        optionId: "approve",
        titleKey: "messages.decision.title",
        bodyKey: "messages.decision.body",
        hints: [],
        effects: [{ nationId: "uk", attribute: "treasury", delta: -25 }],
      },
      {
        optionId: "decline",
        titleKey: "messages.decision.title",
        bodyKey: "messages.decision.body",
        hints: [],
        effects: [],
      },
    ],
  };
  const BATTLE_ID = "test-pending-battle";
  const DECISION_SEED = "e2e-decision-battle-seed-0123456789";

  const withoutBattleOffers = Layer.effect(
    ContentArtifact,
    Effect.gen(function* () {
      const real = yield* ContentArtifact;
      return { ...real, loadBattleOfferRules: () => Effect.succeed(undefined) };
    }),
  ).pipe(Layer.provide(contentArtifactLayer()));

  const decisionRuntime = ManagedRuntime.make(
    Layer.mergeAll(
      desktopMainLayer(),
      withoutBattleOffers,
      Layer.succeed(DecisionSource, {
        pendingDecisions: () => Effect.succeed([TEST_DECISION]),
      }),
    ),
  );

  async function runDecisionProgram<T>(
    program: AnyCommandHandler,
    payload: unknown,
  ): Promise<BridgeResult<T>> {
    return projectCommandExit(
      await decisionRuntime.runPromiseExit(programFor(program)(payload)),
    ) as BridgeResult<T>;
  }

  function registerBattleSession(sessionId: string, saveDir: string) {
    const signal = new AbortController().signal;
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(GENERATED_ARTIFACT, signal, collector);
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");
    const base = toSaveableState(output.state);
    const attacker = base.snapshot.nations.get("uk");
    const defender = base.snapshot.nations.get("france");
    if (!attacker || !defender) throw new Error("production nations uk/france missing");
    const battle: BattleInstance = {
      id: BATTLE_ID,
      phase: "pending",
      attackerId: "uk",
      defenderId: "france",
      areaId: base.snapshot.world.areas[0]?.id ?? "eng_home_coast",
      attackerFleetIds: attacker.fleets.map((fleet) => fleet.id),
      defenderFleetIds: defender.fleets.map((fleet) => fleet.id),
    };
    const snapshot = {
      ...base.snapshot,
      wars: { ...base.snapshot.wars, wars: [], battles: [battle] },
    };
    const envelope = createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot);
    const state: CampaignState = toSaveableState({
      snapshot,
      envelope,
      rawHash: base.rawHash,
    });
    new SaveStore().save(state, saveDir);
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: DECISION_SEED,
      month: { month: 1, year: 1880 },
      state,
    });
  }

  function reloadSessionFromDisk(sessionId: string, saveDir: string) {
    const loaded = new SaveStore().load(saveDir, new DiagnosticCollector());
    if (!loaded) throw new Error("save failed to reload");
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: DECISION_SEED,
      month: { month: 1, year: 1880 },
      state: loaded,
    });
  }

  it("advances several turns with messages, finances, construction and research agreeing, and survives save/load", async () => {
    const saveDir = join(saveRoot, "campaign");
    registerProductionSession("session-e2e", saveDir);

    const seen = { finance: 0, construction: 0, research: 0, total: 0 };
    let previousTreasury: number | null = null;

    for (let turn = 0; turn < 3; turn++) {
      const result = await resolveTurn("session-e2e", turn);
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      expect(result.value.status).toBe("completed");
      if (result.value.status !== "completed") return;

      expect(result.value.closing.revision).toBe(turn + 1);
      expect(Number.isFinite(result.value.closing.closingTreasury)).toBe(true);
      if (previousTreasury !== null) {
        expect(result.value.closing.closingTreasury).not.toBe(previousTreasury);
      }
      previousTreasury = result.value.closing.closingTreasury;

      for (const message of result.value.summary.messages) {
        expect(message.playerVisible).toBe(true);
        seen.total += 1;
        if (message.category === "FINANCE") seen.finance += 1;
        if (message.category === "CONSTRUCTION") seen.construction += 1;
        if (message.category === "RESEARCH") seen.research += 1;
      }
    }

    const summaries = await runProgram(readTurnSummariesProgram, "session-e2e");
    expect(summaries.outcome).toBe("success");
    if (summaries.outcome !== "success") return;
    expect((summaries.value as ReadTurnSummariesResult).summaries).toHaveLength(3);

    const pending = await runProgram(readPendingTurnProgram, "session-e2e");
    expect(pending.outcome).toBe("success");
    if (pending.outcome !== "success") return;
    expect((pending.value as ReadPendingTurnResult).pending).toBeNull();

    expect(seen.total).toBeGreaterThan(0);
    expect(seen.finance).toBeGreaterThan(0);
    expect(existsSync(join(saveDir, TURN_SUMMARIES_FILENAME))).toBe(true);
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(false);

    const loaded = new SaveStore().load(saveDir, new DiagnosticCollector());
    expect(loaded).not.toBeNull();
    expect(Number(loaded?.snapshot.turnNumber)).toBe(3);
  });

  it("is deterministic: two identical campaigns produce identical authoritative state", async () => {
    const saveDirA = join(saveRoot, "a");
    const saveDirB = join(saveRoot, "b");
    registerProductionSession("session-a", saveDirA);
    registerProductionSession("session-b", saveDirB);

    for (let turn = 0; turn < 2; turn++) {
      await resolveTurn("session-a", turn);
      await resolveTurn("session-b", turn);
    }

    const a = getCampaignSession("session-a")!.state;
    const b = getCampaignSession("session-b")!.state;
    expect(a.rawHash).toBe(b.rawHash);
    expect(JSON.stringify(a.snapshot)).toBe(JSON.stringify(b.snapshot));
  });

  it("a rejected stale revision aborts before committing and restores the pre-turn state", async () => {
    const saveDir = join(saveRoot, "rollback");
    registerProductionSession("session-rb", saveDir);
    const before = getCampaignSession("session-rb")!.state.rawHash;
    const beforeRevision = Number(getCampaignSession("session-rb")!.state.snapshot.turnNumber);

    const result = await resolveTurn("session-rb", 99);
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") return;
    expect(result.reason).toBe("REVISION_MISMATCH");
    expect(getCampaignSession("session-rb")!.state.rawHash).toBe(before);
    expect(Number(getCampaignSession("session-rb")!.state.snapshot.turnNumber)).toBe(
      beforeRevision,
    );
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(false);
  });

  it("suspends on a decision then a battle, resumes after a reload exactly once, and re-executes identically", async () => {
    const saveDir = join(saveRoot, "suspended");
    registerBattleSession("session-susp", saveDir);

    const first = await runDecisionProgram<ResolveTurnResult>(resolveTurnProgram, {
      sessionId: "session-susp",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(first.outcome).toBe("success");
    if (first.outcome !== "success") return;
    expect(first.value.status).toBe("suspended");
    if (first.value.status !== "suspended") return;
    expect(first.value.request?.kind).toBe("decision");
    if (first.value.request?.kind !== "decision") return;
    const decisionRequest = first.value.request;
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(true);

    const second = await runDecisionProgram<ResolveTurnResult>(answerDecisionProgram, {
      sessionId: "session-susp",
      expectedRevision: 0,
      transportRequestId: "req-2",
      interruptionId: decisionRequest.interruptionId,
      decisionId: decisionRequest.decisionId ?? "",
      optionId: TEST_DECISION.options[0]!.optionId,
    });
    expect(second.outcome).toBe("success");
    if (second.outcome !== "success") return;
    expect(second.value.status).toBe("suspended");
    if (second.value.status !== "suspended") return;
    expect(second.value.request?.kind).toBe("battle");
    if (second.value.request?.kind !== "battle") return;
    const battleRequest = second.value.request;

    removeCampaignSession("session-susp");
    expect(getCampaignSession("session-susp")).toBeUndefined();
    reloadSessionFromDisk("session-susp", saveDir);

    const third = await runDecisionProgram<ResolveTurnResult>(submitBattleResultProgram, {
      sessionId: "session-susp",
      expectedRevision: 0,
      transportRequestId: "req-3",
      interruptionId: battleRequest.interruptionId,
      battleId: battleRequest.battleId ?? "",
      winnerId: null,
      loserId: null,
      attackerLosses: [],
      defenderLosses: [],
      damageReport: {},
    });
    expect(third.outcome).toBe("success");
    if (third.outcome !== "success") return;
    expect(third.value.status).toBe("completed");
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(false);

    const suspendedState = getCampaignSession("session-susp")!.state;
    expect(Number(suspendedState.snapshot.turnNumber)).toBe(1);
    const resolvedBattle = suspendedState.snapshot.wars.battles.find((b) => b.id === BATTLE_ID);
    expect(resolvedBattle?.phase).toBe("resolved");
    expect(resolvedBattle?.result).toBeDefined();

    const summaries = await runProgram(readTurnSummariesProgram, "session-susp");
    expect(summaries.outcome).toBe("success");
    if (summaries.outcome !== "success") return;
    expect((summaries.value as ReadTurnSummariesResult).summaries).toHaveLength(1);

    const parityDir = join(saveRoot, "parity");
    registerBattleSession("session-parity", parityDir);
    const decisionInput = makeRecordedInput({
      ordinal: 0,
      kind: "decision",
      interruptionId: decisionRequest.interruptionId,
      payload: {
        interruptionId: decisionRequest.interruptionId,
        decisionId: decisionRequest.decisionId ?? "",
        optionId: TEST_DECISION.options[0]!.optionId,
      },
    });
    const battleInterruptionId = computeInterruptionId({
      turnId: decisionRequest.turnId,
      phase: "battle_resolution",
      ordinal: 1,
      subjectKey: BATTLE_ID,
    });
    expect(battleInterruptionId).toBe(battleRequest.interruptionId);
    const battleInput = makeRecordedInput({
      ordinal: 1,
      kind: "battle",
      interruptionId: battleInterruptionId,
      payload: {
        interruptionId: battleInterruptionId,
        battleId: BATTLE_ID,
        winnerId: null,
        loserId: null,
        attackerLosses: [],
        defenderLosses: [],
        damageReport: {},
      },
    });
    const parity = await decisionRuntime.runPromise(
      runTurnTransaction({
        sessionId: "session-parity",
        expectedRevision: 0,
        recordedInputs: [decisionInput, battleInput],
        pendingDecisions: [TEST_DECISION],
        allowInterruptions: true,
      }),
    );
    expect(parity.kind).toBe("completed");
    const parityState = getCampaignSession("session-parity")!.state;
    expect(parityState.rawHash).toBe(suspendedState.rawHash);
    expect(JSON.stringify(parityState.snapshot)).toBe(JSON.stringify(suspendedState.snapshot));
  });
});
