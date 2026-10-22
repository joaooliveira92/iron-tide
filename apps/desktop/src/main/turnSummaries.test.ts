import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type CommitMonthResponse } from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../shared/bridge-contract.js";
import type {
  ReadTurnSummariesResult,
  TurnSummaryEntry,
} from "../shared/campaign-command-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "./campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "./compiler.js";
import { commitMonthProgram } from "./commands/commitMonth.js";
import { projectCommandExit } from "./runtime/bridgeResult.js";
import { programFor, type AnyCommandHandler } from "./commandProgramFixtures.js";
import { desktopMainLayer } from "./runtime/desktopMainLayer.js";
import { toSaveableState } from "./saveHelpers.js";
import {
  TURN_SUMMARIES_FILENAME,
  TURN_SUMMARIES_LIMIT,
  appendTurnSummary,
  emptyTurnSummaries,
  loadTurnSummaries,
  readTurnSummariesProgram,
  saveTurnSummaries,
} from "./turnSummaries.js";

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

const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram(commitMonthProgram, payload) as Promise<BridgeResult<CommitMonthResponse>>;

const entry = (n: number): TurnSummaryEntry => ({
  turnId: `turn-${n}`,
  projectionVersion: "1.0.0",
  occurredAt: `1880-0${(n % 9) + 1}`,
  rulesetVersion: "0.1.0",
  contentVersion: "0.5.0",
  messages: [],
});

describe("turn-summaries sidecar", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-turn-summaries-"));
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

  it("empty and append behave like the monthly-report window", () => {
    expect(emptyTurnSummaries()).toEqual({ summaries: [] });
    let data = emptyTurnSummaries();
    for (let n = 1; n <= TURN_SUMMARIES_LIMIT + 2; n++) data = appendTurnSummary(data, entry(n));
    expect(data.summaries).toHaveLength(TURN_SUMMARIES_LIMIT);
    expect(data.summaries[0]?.turnId).toBe(`turn-${TURN_SUMMARIES_LIMIT + 2}`);
  });

  it("writes atomically with no tmp leftover", () => {
    const saveDir = join(saveRoot, "atomic");
    registerProductionSession("session-atomic", saveDir);
    saveTurnSummaries(saveDir, { summaries: [entry(1)] });
    const path = join(saveDir, TURN_SUMMARIES_FILENAME);
    expect(existsSync(path)).toBe(true);
    expect(existsSync(`${path}.tmp`)).toBe(false);
  });

  it("reads a missing or corrupt sidecar as empty", () => {
    const saveDir = join(saveRoot, "tolerant");
    registerProductionSession("session-tolerant", saveDir);
    expect(loadTurnSummaries(saveDir)).toEqual({ summaries: [] });
    writeFileSync(join(saveDir, TURN_SUMMARIES_FILENAME), "{not json", "utf8");
    expect(loadTurnSummaries(saveDir)).toEqual({ summaries: [] });
  });

  it("commitMonth projects messages and appends them to the sidecar", async () => {
    const saveDir = join(saveRoot, "real");
    registerProductionSession("session-real", saveDir);

    const result = await commitMonth({
      sessionId: "session-real",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(result.outcome).toBe("success");

    const read = await runProgram(readTurnSummariesProgram, "session-real");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    const summaries = (read.value as ReadTurnSummariesResult).summaries;
    expect(summaries).toHaveLength(1);
    const summary = summaries[0]!;
    expect(summary.turnId).toBeTruthy();
    expect(summary.projectionVersion).toBe("1.0.0");
    expect(summary.messages.length).toBeGreaterThan(0);
    expect(summary.messages.every((m) => m.playerVisible)).toBe(true);
    expect(summary.messages.every((m) => m.severity !== "TRACE")).toBe(true);
    expect(summary.messages.every((m) => m.turnId === summary.turnId)).toBe(true);

    const saveId = new SaveStore().getActiveSaveId(saveDir);
    expect(saveId).not.toBeNull();
    expect(existsSync(join(saveDir, TURN_SUMMARIES_FILENAME))).toBe(true);
    expect(existsSync(join(saveDir, saveId!, TURN_SUMMARIES_FILENAME))).toBe(false);
  });

  it("a session with no sidecar loads normally (empty summaries)", async () => {
    const saveDir = join(saveRoot, "fresh");
    registerProductionSession("session-fresh", saveDir);
    const read = await runProgram(readTurnSummariesProgram, "session-fresh");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect((read.value as ReadTurnSummariesResult).summaries).toEqual([]);
  });

  it("never affects the authoritative envelope/hash", async () => {
    const saveDirA = join(saveRoot, "engine-a");
    const saveDirB = join(saveRoot, "engine-b");
    registerProductionSession("session-engine-a", saveDirA);
    registerProductionSession("session-engine-b", saveDirB);
    saveTurnSummaries(saveDirB, { summaries: [entry(1)] });

    const runA = await commitMonth({
      sessionId: "session-engine-a",
      expectedRevision: 0,
      transportRequestId: "req-a",
    });
    const runB = await commitMonth({
      sessionId: "session-engine-b",
      expectedRevision: 0,
      transportRequestId: "req-b",
    });
    expect(runA.outcome).toBe("success");
    expect(runB.outcome).toBe("success");
    expect(getCampaignSession("session-engine-a")!.state.rawHash).toBe(
      getCampaignSession("session-engine-b")!.state.rawHash,
    );
    expect(JSON.stringify(getCampaignSession("session-engine-a")!.state.snapshot)).toBe(
      JSON.stringify(getCampaignSession("session-engine-b")!.state.snapshot),
    );
  });
});
