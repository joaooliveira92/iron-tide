import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeOrderedInputsHash, computeTurnId } from "@bluewave/messages";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  AbandonPendingTurnResult,
  ReadPendingTurnResult,
  ResolveTurnResult,
} from "../../shared/campaign-command-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import {
  PENDING_TURN_FILENAME,
  buildPendingTurn,
  clearPendingTurn,
  isPendingTurnValid,
  loadPendingTurn,
  savePendingTurn,
  type PendingTurnRecord,
} from "../pendingTurn.js";
import { armamentContentHash, shipBuildingContentHash } from "../shipBuildingContent.js";
import {
  abandonPendingTurnProgram,
  answerDecisionProgram,
  readPendingTurnProgram,
  resolveTurnProgram,
  submitBattleResultProgram,
} from "./resolveTurn.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

const runtime = ManagedRuntime.make(desktopMainLayer());

async function runProgram(
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<unknown>> {
  return projectCommandExit(await runtime.runPromiseExit(programFor(program)(payload)));
}

describe("turn transaction commands", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-resolve-turn-"));
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
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });
  }

  it("pending-turn sidecar: save, load, validate, clear", () => {
    const saveDir = join(saveRoot, "sidecar");
    registerProductionSession("session-sidecar", saveDir);
    const record = buildPendingTurn({
      projectionVersion: "1.0.0",
      turnId: "turn-x",
      campaignId: "c1",
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
    expect(loadPendingTurn(saveDir)).toBeNull();
    savePendingTurn(saveDir, record);
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(true);
    expect(loadPendingTurn(saveDir)).toEqual(record);
    expect(
      isPendingTurnValid(record, {
        campaignId: "c1",
        startingRevision: 0,
        rulesetVersion: "0.1.0",
        compatibilityVersion: "0.1.0",
        turnId: "turn-x",
      }),
    ).toBe(true);
    expect(
      isPendingTurnValid(record, {
        campaignId: "other",
        startingRevision: 0,
        rulesetVersion: "0.1.0",
        compatibilityVersion: "0.1.0",
        turnId: "turn-x",
      }),
    ).toBe(false);
    clearPendingTurn(saveDir);
    expect(loadPendingTurn(saveDir)).toBeNull();
  });

  it("resolveTurn completes an uninterrupted turn and writes no pending turn", async () => {
    const saveDir = join(saveRoot, "complete");
    registerProductionSession("session-complete", saveDir);

    const result = await runProgram(resolveTurnProgram, {
      sessionId: "session-complete",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    const value = result.value as ResolveTurnResult;
    expect(value.status).toBe("completed");
    if (value.status !== "completed") return;
    expect(value.summary.messages.length).toBeGreaterThan(0);
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(false);
    expect(Number(getCampaignSession("session-complete")!.state.snapshot.turnNumber)).toBe(1);
  });

  it("resolveTurn reports a stale pending turn as unavailable and mutates nothing", async () => {
    const saveDir = join(saveRoot, "stale");
    registerProductionSession("session-stale", saveDir);
    const before = getCampaignSession("session-stale")!.state.rawHash;
    savePendingTurn(
      saveDir,
      buildPendingTurn({
        projectionVersion: "1.0.0",
        turnId: "bogus-turn-id",
        campaignId: getCampaignSession("session-stale")!.state.snapshot.campaignId,
        playerNationId: "uk",
        startingRevision: 0,
        rulesetVersion: getCampaignSession("session-stale")!.state.snapshot.rulesetVersion,
        compatibilityVersion:
          getCampaignSession("session-stale")!.state.snapshot.compatibilityVersion,
        contentHashes: { shipBuilding: "s", armament: "a", contentArtifact: "c" },
        committedOrderHash: "h",
        recordedInputs: [],
        nextInterruptionOrdinal: 0,
        createdAt: "1880-01",
      }),
    );

    const result = await runProgram(resolveTurnProgram, {
      sessionId: "session-stale",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    expect((result.value as ResolveTurnResult).status).toBe("unavailable");
    expect(getCampaignSession("session-stale")!.state.rawHash).toBe(before);
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(true);
  });

  it("abandonPendingTurn clears only the sidecar", async () => {
    const saveDir = join(saveRoot, "abandon");
    registerProductionSession("session-abandon", saveDir);
    const before = getCampaignSession("session-abandon")!.state.rawHash;
    savePendingTurn(
      saveDir,
      buildPendingTurn({
        projectionVersion: "1.0.0",
        turnId: "turn-any",
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
      }),
    );

    const result = await runProgram(abandonPendingTurnProgram, "session-abandon");
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    expect((result.value as AbandonPendingTurnResult).abandoned).toBe(true);
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(false);
    expect(getCampaignSession("session-abandon")!.state.rawHash).toBe(before);
    expect(Number(getCampaignSession("session-abandon")!.state.snapshot.turnNumber)).toBe(0);
  });

  function saveOutstandingPending(
    saveDir: string,
    outstanding: NonNullable<PendingTurnRecord["outstanding"]>,
  ) {
    savePendingTurn(
      saveDir,
      buildPendingTurn({
        projectionVersion: "1.0.0",
        turnId: "turn-outstanding",
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
        outstanding,
      }),
    );
  }

  it("rejects a decision answer with a mismatched interruptionId and leaves the sidecar unchanged", async () => {
    const saveDir = join(saveRoot, "decision-mismatch");
    registerProductionSession("session-decision-mismatch", saveDir);
    saveOutstandingPending(saveDir, {
      kind: "decision",
      phase: "appropriation",
      ordinal: 0,
      subjectKey: "uk",
    });
    const before = loadPendingTurn(saveDir);

    const result = await runProgram(answerDecisionProgram, {
      sessionId: "session-decision-mismatch",
      expectedRevision: 0,
      transportRequestId: "req-1",
      interruptionId: "tampered-id",
      decisionId: "dec-1",
      optionId: "approve",
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INTERRUPTION_ID_MISMATCH");
    expect(loadPendingTurn(saveDir)).toEqual(before);
  });

  it("rejects a battle result with a mismatched interruptionId and leaves the sidecar unchanged", async () => {
    const saveDir = join(saveRoot, "battle-mismatch");
    registerProductionSession("session-battle-mismatch", saveDir);
    saveOutstandingPending(saveDir, {
      kind: "battle",
      phase: "battle_resolution",
      ordinal: 0,
      subjectKey: "battle-1",
    });
    const before = loadPendingTurn(saveDir);

    const result = await runProgram(submitBattleResultProgram, {
      sessionId: "session-battle-mismatch",
      expectedRevision: 0,
      transportRequestId: "req-1",
      interruptionId: "tampered-id",
      battleId: "battle-1",
      winnerId: "uk",
      loserId: "fr",
      attackerLosses: [],
      defenderLosses: [],
      damageReport: {},
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INTERRUPTION_ID_MISMATCH");
    expect(loadPendingTurn(saveDir)).toEqual(before);
  });

  it("readPendingTurn reports a stale pending turn as invalid without mutating anything", async () => {
    const saveDir = join(saveRoot, "read-stale");
    registerProductionSession("session-read-stale", saveDir);
    const state = getCampaignSession("session-read-stale")!.state;
    const before = state.rawHash;
    savePendingTurn(
      saveDir,
      buildPendingTurn({
        projectionVersion: "1.0.0",
        turnId: "bogus-turn-id",
        campaignId: state.snapshot.campaignId,
        playerNationId: "uk",
        startingRevision: 0,
        rulesetVersion: state.snapshot.rulesetVersion,
        compatibilityVersion: state.snapshot.compatibilityVersion,
        contentHashes: {
          shipBuilding: shipBuildingContentHash(),
          armament: armamentContentHash(),
          contentArtifact: state.rawHash,
        },
        committedOrderHash: "h",
        recordedInputs: [],
        nextInterruptionOrdinal: 0,
        createdAt: "1880-01",
      }),
    );

    const result = await runProgram(readPendingTurnProgram, "session-read-stale");
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    const value = result.value as ReadPendingTurnResult;
    expect(value.pending).not.toBeNull();
    expect(value.valid).toBe(false);
    expect(getCampaignSession("session-read-stale")!.state.rawHash).toBe(before);
    expect(existsSync(join(saveDir, PENDING_TURN_FILENAME))).toBe(true);
  });

  it("readPendingTurn reports a matching pending turn as valid", async () => {
    const saveDir = join(saveRoot, "read-valid");
    registerProductionSession("session-read-valid", saveDir);
    const state = getCampaignSession("session-read-valid")!.state;
    const committedOrderHash = "orders";
    const turnId = computeTurnId({
      campaignId: state.snapshot.campaignId,
      startingRevision: 0,
      committedOrderHash,
      orderedInputsHash: computeOrderedInputsHash([]),
    });
    savePendingTurn(
      saveDir,
      buildPendingTurn({
        projectionVersion: "1.0.0",
        turnId,
        campaignId: state.snapshot.campaignId,
        playerNationId: "uk",
        startingRevision: 0,
        rulesetVersion: state.snapshot.rulesetVersion,
        compatibilityVersion: state.snapshot.compatibilityVersion,
        contentHashes: {
          shipBuilding: shipBuildingContentHash(),
          armament: armamentContentHash(),
          contentArtifact: state.rawHash,
        },
        committedOrderHash,
        recordedInputs: [],
        nextInterruptionOrdinal: 0,
        createdAt: "1880-01",
      }),
    );

    const result = await runProgram(readPendingTurnProgram, "session-read-valid");
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    const value = result.value as ReadPendingTurnResult;
    expect(value.pending).not.toBeNull();
    expect(value.valid).toBe(true);
  });
});
