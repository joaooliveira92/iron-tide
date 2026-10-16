import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  AbandonPendingTurnResult,
  ResolveTurnResult,
} from "../../shared/campaign-command-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import type { CommandProgram } from "../runtime/commandProgram.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import {
  PENDING_TURN_FILENAME,
  buildPendingTurn,
  clearPendingTurn,
  isPendingTurnValid,
  loadPendingTurn,
  savePendingTurn,
} from "../pendingTurn.js";
import { abandonPendingTurnProgram, resolveTurnProgram } from "./resolveTurn.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

const runtime = ManagedRuntime.make(desktopMainLayer());

async function runProgram(
  program: CommandProgram,
  payload: unknown,
): Promise<BridgeResult<unknown>> {
  return projectCommandExit(await runtime.runPromiseExit(program(payload)));
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
});
