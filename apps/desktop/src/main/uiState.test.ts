import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../shared/bridge-contract.js";
import type {
  ReadUiStateResult,
  UiState,
  WriteUiStateResult,
} from "../shared/campaign-command-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "./campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "./compiler.js";
import { commitMonthProgram } from "./commands/commitMonth.js";
import { projectCommandExit } from "./runtime/bridgeResult.js";
import type { CommandProgram } from "./runtime/commandProgram.js";
import { desktopMainLayer } from "./runtime/desktopMainLayer.js";
import { toSaveableState } from "./saveHelpers.js";
import {
  UI_STATE_FILENAME,
  emptyUiState,
  loadUiState,
  readUiStateProgram,
  resolveUiState,
  writeUiStateProgram,
} from "./uiState.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

// One shared runtime for both programs; the services delegate to the same
// in-memory session registry the tests populate directly.
const runtime = ManagedRuntime.make(desktopMainLayer());

/** Runs a command program through the desktop service graph and projects its wire envelope. */
async function runProgram(
  program: CommandProgram,
  payload: unknown,
): Promise<BridgeResult<unknown>> {
  return projectCommandExit(await runtime.runPromiseExit(program(payload)));
}

/** Runs the commit-month program through the desktop service graph. */
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram(commitMonthProgram, payload) as Promise<BridgeResult<CommitMonthResponse>>;

describe("ui-state sidecar", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-ui-state-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  /** Register a fresh production session (turn 0) in `saveDir`. */
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
    return state;
  }

  it("emptyUiState yields empty defaults at the given turn", () => {
    expect(emptyUiState(3)).toEqual({ turnNumber: 3, dismissedFingerprints: [] });
    expect(emptyUiState(0).firstMonthInspection).toBeUndefined();
  });

  it("resolveUiState honors dismissal only at the matching turn and preserves inspection across turns", () => {
    const stored: UiState = {
      turnNumber: 0,
      dismissedFingerprints: ["fp-a", "fp-b"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 2 },
    };

    // Same turn: dismissals honored, inspection intact.
    expect(resolveUiState(stored, 0)).toEqual(stored);

    // Turn advanced: dismissals expire, inspection persists.
    const advanced = resolveUiState(stored, 1);
    expect(advanced.dismissedFingerprints).toEqual([]);
    expect(advanced.firstMonthInspection).toEqual({
      status: "in_progress",
      lastCompletedStep: 2,
    });
    expect(advanced.turnNumber).toBe(1);
  });

  it("writes ui-state.json atomically (tmp -> rename) with no tmp leftover", async () => {
    const saveDir = join(saveRoot, "atomic");
    registerProductionSession("session-atomic", saveDir);

    const result = await runProgram(writeUiStateProgram, {
      sessionId: "session-atomic",
      dismissedFingerprints: ["fp-1"],
      firstMonthInspection: { status: "completed", lastCompletedStep: 6 },
    });
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    const expected: UiState = {
      turnNumber: 0,
      dismissedFingerprints: ["fp-1"],
      firstMonthInspection: { status: "completed", lastCompletedStep: 6 },
    };
    expect((result.value as WriteUiStateResult).uiState).toEqual(expected);

    const path = join(saveDir, UI_STATE_FILENAME);
    expect(existsSync(path)).toBe(true);
    expect(existsSync(`${path}.tmp`)).toBe(false);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(expected);
  });

  it("readUiState/writeUiState round-trip per campaign", async () => {
    const saveDir = join(saveRoot, "roundtrip");
    registerProductionSession("session-rt", saveDir);

    const write = await runProgram(writeUiStateProgram, {
      sessionId: "session-rt",
      dismissedFingerprints: ["fp-1", "fp-2"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 3 },
    });
    expect(write.outcome).toBe("success");
    if (write.outcome !== "success") return;
    expect((write.value as WriteUiStateResult).uiState).toEqual({
      turnNumber: 0,
      dismissedFingerprints: ["fp-1", "fp-2"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 3 },
    });

    const read = await runProgram(readUiStateProgram, "session-rt");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect((read.value as ReadUiStateResult).uiState).toEqual(
      (write.value as WriteUiStateResult).uiState,
    );
  });

  it("merge-preserves the sibling feature: a dismissal-only write retains the stored inspection state", async () => {
    const saveDir = join(saveRoot, "merge");
    registerProductionSession("session-merge", saveDir);

    // First writer (inspection): combined state.
    const combined = await runProgram(writeUiStateProgram, {
      sessionId: "session-merge",
      dismissedFingerprints: ["fp-a"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 3 },
    });
    expect(combined.outcome).toBe("success");
    if (combined.outcome !== "success") return;

    // Second writer (dismissal-only): sends no firstMonthInspection.
    const dismissalOnly = await runProgram(writeUiStateProgram, {
      sessionId: "session-merge",
      dismissedFingerprints: ["fp-b", "fp-c"],
    });
    expect(dismissalOnly.outcome).toBe("success");
    if (dismissalOnly.outcome !== "success") return;

    // The inspection object is carried forward, not dropped.
    expect((dismissalOnly.value as WriteUiStateResult).uiState).toEqual({
      turnNumber: 0,
      dismissedFingerprints: ["fp-b", "fp-c"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 3 },
    });
    const read = await runProgram(readUiStateProgram, "session-merge");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect((read.value as ReadUiStateResult).uiState).toEqual(
      (dismissalOnly.value as WriteUiStateResult).uiState,
    );
  });

  it("round-trips the inspector layout and merge-preserves it across a dismissal-only write", async () => {
    const saveDir = join(saveRoot, "inspector");
    registerProductionSession("session-inspector", saveDir);

    const write = await runProgram(writeUiStateProgram, {
      sessionId: "session-inspector",
      dismissedFingerprints: [],
      inspector: { widthPx: 512, collapsed: true },
    });
    expect(write.outcome).toBe("success");
    if (write.outcome !== "success") return;
    expect((write.value as WriteUiStateResult).uiState.inspector).toEqual({
      widthPx: 512,
      collapsed: true,
    });

    // A later writer that carries no inspector (a dismissal-only write) must not erase it.
    const dismissalOnly = await runProgram(writeUiStateProgram, {
      sessionId: "session-inspector",
      dismissedFingerprints: ["fp-a"],
    });
    expect(dismissalOnly.outcome).toBe("success");
    if (dismissalOnly.outcome !== "success") return;
    expect((dismissalOnly.value as WriteUiStateResult).uiState.inspector).toEqual({
      widthPx: 512,
      collapsed: true,
    });

    const read = await runProgram(readUiStateProgram, "session-inspector");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect((read.value as ReadUiStateResult).uiState.inspector).toEqual({
      widthPx: 512,
      collapsed: true,
    });
  });

  it("explicit not_started/0 write resets the stored inspection state", async () => {
    const saveDir = join(saveRoot, "reset");
    registerProductionSession("session-reset", saveDir);

    const combined = await runProgram(writeUiStateProgram, {
      sessionId: "session-reset",
      dismissedFingerprints: ["fp-a"],
      firstMonthInspection: { status: "completed", lastCompletedStep: 6 },
    });
    expect(combined.outcome).toBe("success");
    if (combined.outcome !== "success") return;

    const reset = await runProgram(writeUiStateProgram, {
      sessionId: "session-reset",
      dismissedFingerprints: ["fp-a"],
      firstMonthInspection: { status: "not_started", lastCompletedStep: 0 },
    });
    expect(reset.outcome).toBe("success");
    if (reset.outcome !== "success") return;
    expect((reset.value as WriteUiStateResult).uiState.firstMonthInspection).toEqual({
      status: "not_started",
      lastCompletedStep: 0,
    });
  });

  it("reports a write failure as UI_STATE_WRITE_FAILED and leaves no partial artifact", async () => {
    const saveDir = join(saveRoot, "does-not-exist");
    registerProductionSession("session-write-fail", saveDir);
    // Remove the directory after registration so the atomic write cannot land.
    rmSync(saveDir, { recursive: true, force: true });
    expect(existsSync(saveDir)).toBe(false);

    const result = await runProgram(writeUiStateProgram, {
      sessionId: "session-write-fail",
      dismissedFingerprints: ["fp-1"],
    });
    expect(result).toMatchObject({ outcome: "error", reason: "UI_STATE_WRITE_FAILED" });
    expect(existsSync(join(saveDir, UI_STATE_FILENAME))).toBe(false);
  });

  it("answers SESSION_NOT_FOUND for an unknown session", async () => {
    expect(await runProgram(readUiStateProgram, "nobody")).toMatchObject({
      outcome: "error",
      reason: "SESSION_NOT_FOUND",
    });
    expect(
      await runProgram(writeUiStateProgram, { sessionId: "nobody", dismissedFingerprints: [] }),
    ).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
  });

  it("rejects a payload that fails the wire schema (INVALID_PAYLOAD)", async () => {
    expect(await runProgram(readUiStateProgram, "")).toMatchObject({
      outcome: "error",
      reason: "INVALID_PAYLOAD",
    });
    expect(await runProgram(readUiStateProgram, { sessionId: 1 })).toMatchObject({
      outcome: "error",
      reason: "INVALID_PAYLOAD",
    });
    // `dismissedFingerprints` is required.
    expect(await runProgram(writeUiStateProgram, { sessionId: "s" })).toMatchObject({
      outcome: "error",
      reason: "INVALID_PAYLOAD",
    });
  });

  it("is tolerant of a missing ui-state.json (returns defaults, never crashes)", async () => {
    const saveDir = join(saveRoot, "missing");
    registerProductionSession("session-missing", saveDir);
    const read = await runProgram(readUiStateProgram, "session-missing");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect((read.value as ReadUiStateResult).uiState).toEqual({
      turnNumber: 0,
      dismissedFingerprints: [],
    });
  });

  it("is tolerant of a corrupt ui-state.json (unparseable or wrong shape -> defaults)", async () => {
    const saveDir = join(saveRoot, "corrupt");
    registerProductionSession("session-corrupt", saveDir);
    const path = join(saveDir, UI_STATE_FILENAME);

    // Invalid JSON.
    writeFileSync(path, "{not json", "utf8");
    expect(() => loadUiState(saveDir, 0)).not.toThrow();
    expect(loadUiState(saveDir, 0)).toEqual({ turnNumber: 0, dismissedFingerprints: [] });

    // Valid JSON, wrong shape.
    writeFileSync(path, JSON.stringify({ foo: 1 }), "utf8");
    expect(loadUiState(saveDir, 0)).toEqual({ turnNumber: 0, dismissedFingerprints: [] });

    // The program is likewise tolerant.
    const read = await runProgram(readUiStateProgram, "session-corrupt");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect((read.value as ReadUiStateResult).uiState).toEqual({
      turnNumber: 0,
      dismissedFingerprints: [],
    });
  });

  it("expires dismissals on turn advance and preserves inspection across the real commitMonth", async () => {
    const saveDir = join(saveRoot, "expiry");
    registerProductionSession("session-expiry", saveDir);

    const write = await runProgram(writeUiStateProgram, {
      sessionId: "session-expiry",
      dismissedFingerprints: ["fp-a", "fp-b"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 2 },
    });
    expect(write.outcome).toBe("success");
    if (write.outcome !== "success") return;

    // Same turn: honored.
    const before = await runProgram(readUiStateProgram, "session-expiry");
    expect(before.outcome).toBe("success");
    if (before.outcome !== "success") return;
    expect((before.value as ReadUiStateResult).uiState.dismissedFingerprints).toEqual([
      "fp-a",
      "fp-b",
    ]);

    // Advance the real month (turn 0 -> 1): dismissals expire, inspection persists.
    const advance = await commitMonth({
      sessionId: "session-expiry",
      expectedRevision: 0,
      transportRequestId: "req-advance",
    });
    expect(advance.outcome).toBe("success");
    expect(Number(getCampaignSession("session-expiry")!.state.snapshot.turnNumber)).toBe(1);

    const after = await runProgram(readUiStateProgram, "session-expiry");
    expect(after.outcome).toBe("success");
    if (after.outcome !== "success") return;
    const uiState = (after.value as ReadUiStateResult).uiState;
    expect(uiState.turnNumber).toBe(1);
    expect(uiState.dismissedFingerprints).toEqual([]);
    expect(uiState.firstMonthInspection).toEqual({
      status: "in_progress",
      lastCompletedStep: 2,
    });
  });

  it("persists outside the authoritative envelope and survives a save/load cycle", async () => {
    const saveDir = join(saveRoot, "survive");
    registerProductionSession("session-survive", saveDir);

    const write = await runProgram(writeUiStateProgram, {
      sessionId: "session-survive",
      dismissedFingerprints: ["fp-1"],
      firstMonthInspection: { status: "dismissed", lastCompletedStep: 1 },
    });
    expect(write.outcome).toBe("success");
    if (write.outcome !== "success") return;

    // The sidecar is a sibling of the save ids — never inside the SaveStore
    // directory that makes up the authoritative envelope.
    const path = join(saveDir, UI_STATE_FILENAME);
    expect(existsSync(path)).toBe(true);
    const saveId = new SaveStore().getActiveSaveId(saveDir);
    expect(saveId).not.toBeNull();
    expect(existsSync(join(saveDir, saveId!, UI_STATE_FILENAME))).toBe(false);
    expect(existsSync(join(saveDir, saveId!, "campaign.json"))).toBe(true);

    // Full save/load cycle: a fresh session bound to the same saveDir (as a
    // reloaded campaign would be) still sees the sidecar.
    const store = new SaveStore();
    const collector = new DiagnosticCollector();
    const reloaded = store.load(saveDir, collector);
    expect(reloaded).not.toBeNull();
    if (!reloaded) return;
    registerCampaignSession({
      sessionId: "session-reloaded",
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state: reloaded,
    });
    const read = await runProgram(readUiStateProgram, "session-reloaded");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect((read.value as ReadUiStateResult).uiState.firstMonthInspection).toEqual({
      status: "dismissed",
      lastCompletedStep: 1,
    });
  });

  it("never affects the authoritative envelope/hash or MonthExecutor output", async () => {
    // Two identical sessions (same pack, same seed, same turn); only one has a
    // populated sidecar. Their post-commit authoritative hashes must match.
    const saveDirA = join(saveRoot, "engine-a");
    const saveDirB = join(saveRoot, "engine-b");
    registerProductionSession("session-engine-a", saveDirA);
    registerProductionSession("session-engine-b", saveDirB);

    // `toSaveableState`'s rawHash is computed over {snapshot, envelope} only —
    // the sidecar write never touches CampaignState, so the in-memory state's
    // authoritative hash is identical whether or not a sidecar exists.
    const before = getCampaignSession("session-engine-a")!.state.rawHash;
    const write = await runProgram(writeUiStateProgram, {
      sessionId: "session-engine-a",
      dismissedFingerprints: ["fp-x", "fp-y", "fp-z"],
      firstMonthInspection: { status: "completed", lastCompletedStep: 6 },
    });
    expect(write.outcome).toBe("success");
    expect(getCampaignSession("session-engine-a")!.state.rawHash).toBe(before);

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

    // Identical MonthExecutor result -> identical persisted authoritative state
    // (revision, turnNumber, rawHash) despite the sidecar difference.
    const stateA = getCampaignSession("session-engine-a")!.state;
    const stateB = getCampaignSession("session-engine-b")!.state;
    expect(stateA.rawHash).toBe(stateB.rawHash);
    expect(Number(stateA.snapshot.turnNumber)).toBe(1);
    expect(Number(stateB.snapshot.turnNumber)).toBe(1);
  });
});
