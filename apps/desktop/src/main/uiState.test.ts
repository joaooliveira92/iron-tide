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
} from "../shared/ui-state-contract.js";
import { dispatchCampaignCommand } from "./campaignBridge.js";
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

describe("ui-state sidecar", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-ui-state-"));
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
    return state;
  }

  it("emptyUiState yields empty defaults at the given turn", () => {
    expect(emptyUiState(3)).toEqual({
      turnNumber: 3,
      dismissedFingerprints: [],
    });
    expect(emptyUiState(0).firstMonthInspection).toBeUndefined();
  });

  it("resolveUiState honors dismissal only at the matching turn and preserves inspection across turns", () => {
    const stored: UiState = {
      turnNumber: 0,
      dismissedFingerprints: ["fp-a", "fp-b"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 2 },
    };

    expect(resolveUiState(stored, 0)).toEqual(stored);

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

    const combined = await runProgram(writeUiStateProgram, {
      sessionId: "session-merge",
      dismissedFingerprints: ["fp-a"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 3 },
    });
    expect(combined.outcome).toBe("success");
    if (combined.outcome !== "success") return;

    const dismissalOnly = await runProgram(writeUiStateProgram, {
      sessionId: "session-merge",
      dismissedFingerprints: ["fp-b", "fp-c"],
    });
    expect(dismissalOnly.outcome).toBe("success");
    if (dismissalOnly.outcome !== "success") return;

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

  describe("field-level patch", () => {
    const patch = async (sessionId: string, fields: Record<string, unknown>) => {
      const result = await runProgram(writeUiStateProgram, { sessionId, ...fields });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") throw new Error("patch failed");
      return (result.value as WriteUiStateResult).uiState;
    };

    it("keeps every field it does not name, including the dismissal set", async () => {
      registerProductionSession("session-patch", join(saveRoot, "patch"));
      await patch("session-patch", {
        dismissedFingerprints: ["fp-a"],
        firstMonthInspection: { status: "in_progress", lastCompletedStep: 2 },
        inspector: { widthPx: 400, collapsed: false },
        turnMessages: { pinnedIds: ["m1"], readIds: ["m2"] },
      });

      const onlyInspector = await patch("session-patch", {
        inspector: { widthPx: 500, collapsed: true },
      });
      expect(onlyInspector).toEqual({
        turnNumber: 0,
        dismissedFingerprints: ["fp-a"],
        firstMonthInspection: { status: "in_progress", lastCompletedStep: 2 },
        inspector: { widthPx: 500, collapsed: true },
        turnMessages: { pinnedIds: ["m1"], readIds: ["m2"] },
      });

      const onlyMessages = await patch("session-patch", {
        turnMessages: { pinnedIds: [], readIds: ["m2", "m3"] },
      });
      expect(onlyMessages.turnMessages).toEqual({ pinnedIds: [], readIds: ["m2", "m3"] });
      expect(onlyMessages.inspector).toEqual({ widthPx: 500, collapsed: true });

      const onlyInspection = await patch("session-patch", {
        firstMonthInspection: { status: "completed", lastCompletedStep: 6 },
      });
      expect(onlyInspection.firstMonthInspection).toEqual({
        status: "completed",
        lastCompletedStep: 6,
      });
      expect(onlyInspection.turnMessages).toEqual({ pinnedIds: [], readIds: ["m2", "m3"] });

      const onlyDismissed = await patch("session-patch", { dismissedFingerprints: ["fp-b"] });
      expect(onlyDismissed.dismissedFingerprints).toEqual(["fp-b"]);
      expect(onlyDismissed.inspector).toEqual({ widthPx: 500, collapsed: true });
    });

    it("lets independent writers interleave without losing each other's field", async () => {
      registerProductionSession("session-race", join(saveRoot, "race"));
      await patch("session-race", { dismissedFingerprints: ["fp-a"] });

      const results = await Promise.all([
        runProgram(writeUiStateProgram, {
          sessionId: "session-race",
          inspector: { widthPx: 420, collapsed: true },
        }),
        runProgram(writeUiStateProgram, {
          sessionId: "session-race",
          turnMessages: { pinnedIds: ["m1"], readIds: [] },
        }),
        runProgram(writeUiStateProgram, {
          sessionId: "session-race",
          firstMonthInspection: { status: "dismissed", lastCompletedStep: 1 },
        }),
      ]);
      expect(results.map((r) => r.outcome)).toEqual(["success", "success", "success"]);

      const read = await runProgram(readUiStateProgram, "session-race");
      if (read.outcome !== "success") throw new Error("read failed");
      expect((read.value as ReadUiStateResult).uiState).toEqual({
        turnNumber: 0,
        dismissedFingerprints: ["fp-a"],
        firstMonthInspection: { status: "dismissed", lastCompletedStep: 1 },
        inspector: { widthPx: 420, collapsed: true },
        turnMessages: { pinnedIds: ["m1"], readIds: [] },
      });
    });

    it("does not alias the payload's turn messages into the stored state", async () => {
      registerProductionSession("session-alias", join(saveRoot, "alias"));
      const pinnedIds = ["m1"];
      const turnMessages = { pinnedIds, readIds: [] as string[] };
      const written = await patch("session-alias", { turnMessages });
      pinnedIds.push("m9");
      expect(written.turnMessages).toEqual({ pinnedIds: ["m1"], readIds: [] });
      expect(written.turnMessages?.pinnedIds).not.toBe(pinnedIds);
    });

    it("rejects excess keys at the wire boundary", async () => {
      registerProductionSession("session-excess", join(saveRoot, "excess"));
      const result = await dispatchCampaignCommand("writeUiState", {
        sessionId: "session-excess",
        inspector: { widthPx: 420, collapsed: true },
        unexpected: true,
      });
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") return;
      expect(result.reason).toBe("INVALID_PAYLOAD");
    });
  });

  it("reports a write failure as UI_STATE_WRITE_FAILED and leaves no partial artifact", async () => {
    const saveDir = join(saveRoot, "does-not-exist");
    registerProductionSession("session-write-fail", saveDir);
    rmSync(saveDir, { recursive: true, force: true });
    expect(existsSync(saveDir)).toBe(false);

    const result = await runProgram(writeUiStateProgram, {
      sessionId: "session-write-fail",
      dismissedFingerprints: ["fp-1"],
    });
    expect(result).toMatchObject({
      outcome: "error",
      reason: "UI_STATE_WRITE_FAILED",
    });
    expect(existsSync(join(saveDir, UI_STATE_FILENAME))).toBe(false);
  });

  it("answers SESSION_NOT_FOUND for an unknown session", async () => {
    expect(await runProgram(readUiStateProgram, "nobody")).toMatchObject({
      outcome: "error",
      reason: "SESSION_NOT_FOUND",
    });
    expect(
      await runProgram(writeUiStateProgram, {
        sessionId: "nobody",
        dismissedFingerprints: [],
      }),
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

    writeFileSync(path, "{not json", "utf8");
    expect(() => loadUiState(saveDir, 0)).not.toThrow();
    expect(loadUiState(saveDir, 0)).toEqual({
      turnNumber: 0,
      dismissedFingerprints: [],
    });

    writeFileSync(path, JSON.stringify({ foo: 1 }), "utf8");
    expect(loadUiState(saveDir, 0)).toEqual({
      turnNumber: 0,
      dismissedFingerprints: [],
    });

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

    const before = await runProgram(readUiStateProgram, "session-expiry");
    expect(before.outcome).toBe("success");
    if (before.outcome !== "success") return;
    expect((before.value as ReadUiStateResult).uiState.dismissedFingerprints).toEqual([
      "fp-a",
      "fp-b",
    ]);

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

    const path = join(saveDir, UI_STATE_FILENAME);
    expect(existsSync(path)).toBe(true);
    const saveId = new SaveStore().getActiveSaveId(saveDir);
    expect(saveId).not.toBeNull();
    expect(existsSync(join(saveDir, saveId!, UI_STATE_FILENAME))).toBe(false);
    expect(existsSync(join(saveDir, saveId!, "campaign.json"))).toBe(true);

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
    const saveDirA = join(saveRoot, "engine-a");
    const saveDirB = join(saveRoot, "engine-b");
    registerProductionSession("session-engine-a", saveDirA);
    registerProductionSession("session-engine-b", saveDirB);

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

    const stateA = getCampaignSession("session-engine-a")!.state;
    const stateB = getCampaignSession("session-engine-b")!.state;
    expect(stateA.rawHash).toBe(stateB.rawHash);
    expect(Number(stateA.snapshot.turnNumber)).toBe(1);
    expect(Number(stateB.snapshot.turnNumber)).toBe(1);
  });
});
