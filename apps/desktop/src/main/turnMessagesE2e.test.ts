import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../shared/bridge-contract.js";
import type {
  ReadPendingTurnResult,
  ReadTurnSummariesResult,
  ResolveTurnResult,
} from "../shared/campaign-command-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "./campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "./compiler.js";
import { readPendingTurnProgram, resolveTurnProgram } from "./commands/resolveTurn.js";
import { PENDING_TURN_FILENAME } from "./pendingTurn.js";
import { projectCommandExit } from "./runtime/bridgeResult.js";
import type { CommandProgram } from "./runtime/commandProgram.js";
import { desktopMainLayer } from "./runtime/desktopMainLayer.js";
import { toSaveableState } from "./saveHelpers.js";
import { TURN_SUMMARIES_FILENAME, readTurnSummariesProgram } from "./turnSummaries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

const runtime = ManagedRuntime.make(desktopMainLayer());

async function runProgram(
  program: CommandProgram,
  payload: unknown,
): Promise<BridgeResult<unknown>> {
  return projectCommandExit(await runtime.runPromiseExit(program(payload)));
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

    // The authoritative save round-trips at the advanced revision.
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
});
