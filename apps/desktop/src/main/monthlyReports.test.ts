import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrioritiesProjection, type CommitMonthResponse } from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../shared/bridge-contract.js";
import type { MonthlyReportEntry, ReadMonthlyReportsResult } from "../shared/reports-contract.js";
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
  MONTHLY_REPORTS_FILENAME,
  MONTHLY_REPORTS_LIMIT,
  appendMonthlyReport,
  emptyMonthlyReports,
  loadMonthlyReports,
  readMonthlyReportsProgram,
  saveMonthlyReports,
} from "./monthlyReports.js";

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

const entry = (month: number): MonthlyReportEntry => ({
  reportId: `save-${month}`,
  campaignId: "camp_1",
  turn: month,
  period: { from: { year: 1880, month }, to: { year: 1880, month: month + 1 } },
  generatedAt: "1880-02-01T00:00:00.000Z",
  treasury: {
    openingTreasury: 0,
    closingTreasury: 0,
    maintenanceCost: 0,
    constructionSpending: 0,
    researchExpense: 0,
    governmentAllocation: 0,
    netChange: 0,
    ledgerRows: [],
  },
  construction: { projects: [], completedShips: [], newlyActiveProjectIds: [] },
  research: { progress: [], discoveries: [] },
  fleet: { additions: [], totalActiveShips: 0 },
  priorities: [],
  battleOutcomes: [],
});

describe("monthly-reports sidecar", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-monthly-reports-"));
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

  it("emptyMonthlyReports yields an empty history", () => {
    expect(emptyMonthlyReports()).toEqual({ reports: [] });
  });

  it("appendMonthlyReport prepends the newest and prunes to the limit", () => {
    let data = emptyMonthlyReports();
    for (let month = 1; month <= MONTHLY_REPORTS_LIMIT + 3; month++) {
      data = appendMonthlyReport(data, entry(month));
    }
    expect(data.reports).toHaveLength(MONTHLY_REPORTS_LIMIT);
    expect(data.reports[0]?.period.from.month).toBe(MONTHLY_REPORTS_LIMIT + 3);
    expect(data.reports.at(-1)?.period.from.month).toBe(4);
  });

  it("writes monthly-reports.json atomically (tmp -> rename) with no tmp leftover", () => {
    const saveDir = join(saveRoot, "atomic");
    registerProductionSession("session-atomic", saveDir);
    const data = { reports: [entry(1)] };

    saveMonthlyReports(saveDir, data);

    const path = join(saveDir, MONTHLY_REPORTS_FILENAME);
    expect(existsSync(path)).toBe(true);
    expect(existsSync(`${path}.tmp`)).toBe(false);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(data);
  });

  it("removes the tmp artifact when the write fails (non-existent save dir)", () => {
    const saveDir = join(saveRoot, "does-not-exist");
    expect(existsSync(saveDir)).toBe(false);
    expect(() => saveMonthlyReports(saveDir, emptyMonthlyReports())).toThrow();
    expect(existsSync(join(saveDir, MONTHLY_REPORTS_FILENAME))).toBe(false);
  });

  it("honours an aborted signal (AbortError, no artifact left)", () => {
    const saveDir = join(saveRoot, "abort");
    registerProductionSession("session-abort", saveDir);
    const controller = new AbortController();
    controller.abort();

    expect(() =>
      saveMonthlyReports(saveDir, emptyMonthlyReports(), controller.signal),
    ).toThrowError(expect.objectContaining({ name: "AbortError" }));
    expect(existsSync(join(saveDir, MONTHLY_REPORTS_FILENAME))).toBe(false);
    expect(existsSync(join(saveDir, `${MONTHLY_REPORTS_FILENAME}.tmp`))).toBe(false);
  });

  it("is tolerant of a missing monthly-reports.json (empty, never crashes)", async () => {
    const saveDir = join(saveRoot, "missing");
    registerProductionSession("session-missing", saveDir);

    expect(loadMonthlyReports(saveDir)).toEqual({ reports: [] });
    const read = await runProgram(readMonthlyReportsProgram, "session-missing");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect((read.value as ReadMonthlyReportsResult).reports).toEqual([]);
  });

  it("is tolerant of a corrupt monthly-reports.json (unparseable or wrong shape -> empty)", async () => {
    const saveDir = join(saveRoot, "corrupt");
    registerProductionSession("session-corrupt", saveDir);
    const path = join(saveDir, MONTHLY_REPORTS_FILENAME);

    writeFileSync(path, "{not json", "utf8");
    expect(() => loadMonthlyReports(saveDir)).not.toThrow();
    expect(loadMonthlyReports(saveDir)).toEqual({ reports: [] });

    writeFileSync(path, JSON.stringify({ reports: [{ turn: 1 }] }), "utf8");
    expect(loadMonthlyReports(saveDir)).toEqual({ reports: [] });

    const read = await runProgram(readMonthlyReportsProgram, "session-corrupt");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    expect((read.value as ReadMonthlyReportsResult).reports).toEqual([]);
  });

  it("returns SESSION_NOT_FOUND for an unknown session", async () => {
    const read = await runProgram(readMonthlyReportsProgram, "no-such-session");
    expect(read.outcome).toBe("error");
    if (read.outcome !== "error") return;
    expect(read.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects a payload that fails the wire schema (INVALID_PAYLOAD)", async () => {
    for (const payload of ["", { sessionId: 123 }]) {
      expect(await runProgram(readMonthlyReportsProgram, payload)).toMatchObject({
        outcome: "error",
        reason: "INVALID_PAYLOAD",
      });
    }
  });

  it("commitMonth appends a faithful report and survives a save/load cycle", async () => {
    const saveDir = join(saveRoot, "real");
    registerProductionSession("session-real", saveDir);

    const result = await commitMonth({
      sessionId: "session-real",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    const read = await runProgram(readMonthlyReportsProgram, "session-real");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    const reports = (read.value as ReadMonthlyReportsResult).reports;
    expect(reports).toHaveLength(1);

    const report = reports[0]!;
    expect(report.reportId).toBeTruthy();
    expect(report.campaignId).toBe(getCampaignSession("session-real")!.state.snapshot.campaignId);
    expect(report.turn).toBe(1);
    expect(report.period).toEqual({
      from: { year: 1880, month: 1 },
      to: { year: 1880, month: 2 },
    });
    expect(report.treasury.openingTreasury).toBe(result.value.report.openingTreasury);
    expect(report.treasury.closingTreasury).toBe(result.value.report.closingTreasury);
    expect(report.treasury.maintenanceCost).toBe(result.value.report.maintenanceCost);
    expect(report.treasury.constructionSpending).toBe(result.value.report.newConstructionSpending);
    expect(report.treasury.netChange).toBe(
      result.value.report.closingTreasury - result.value.report.openingTreasury,
    );
    expect(report.treasury.ledgerRows).toEqual(result.value.financialLedger);
    expect(Array.isArray(report.construction.projects)).toBe(true);
    expect(Array.isArray(report.research.progress)).toBe(true);
    expect(report.battleOutcomes).toEqual(result.value.closingSnapshot.battleOutcomes);
    expect(report.fleet.totalActiveShips).toBeGreaterThan(0);

    const saveId = new SaveStore().getActiveSaveId(saveDir);
    expect(saveId).not.toBeNull();
    const metadata = JSON.parse(readFileSync(join(saveDir, saveId!, "metadata.json"), "utf8")) as {
      timestamp: string;
    };
    expect(report.generatedAt).toBe(metadata.timestamp);

    const expectedFingerprints = buildPrioritiesProjection(
      getCampaignSession("session-real")!.state.snapshot,
      "uk",
    ).map((priority) => priority.fingerprint);
    expect(report.priorities.map((priority) => priority.fingerprint)).toEqual(expectedFingerprints);

    expect(existsSync(join(saveDir, MONTHLY_REPORTS_FILENAME))).toBe(true);
    expect(existsSync(join(saveDir, saveId!, MONTHLY_REPORTS_FILENAME))).toBe(false);

    registerCampaignSession({
      sessionId: "session-reloaded",
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 2, year: 1880 },
      state: getCampaignSession("session-real")!.state,
    });
    const reread = await runProgram(readMonthlyReportsProgram, "session-reloaded");
    expect(reread.outcome).toBe("success");
    if (reread.outcome !== "success") return;
    expect((reread.value as ReadMonthlyReportsResult).reports).toHaveLength(1);
  });

  it("a second commit prepends the new month and keeps the previous report", async () => {
    const saveDir = join(saveRoot, "two-months");
    registerProductionSession("session-two", saveDir);

    const first = await commitMonth({
      sessionId: "session-two",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(first.outcome).toBe("success");
    const second = await commitMonth({
      sessionId: "session-two",
      expectedRevision: 1,
      transportRequestId: "req-2",
    });
    expect(second.outcome).toBe("success");

    const read = await runProgram(readMonthlyReportsProgram, "session-two");
    expect(read.outcome).toBe("success");
    if (read.outcome !== "success") return;
    const reports = (read.value as ReadMonthlyReportsResult).reports;
    expect(reports.map((report) => report.turn)).toEqual([2, 1]);
    expect(reports[1]?.priorities.map((priority) => priority.fingerprint)).toBeDefined();
  });

  it("never affects the authoritative envelope/hash", async () => {
    const saveDirA = join(saveRoot, "engine-a");
    const saveDirB = join(saveRoot, "engine-b");
    registerProductionSession("session-engine-a", saveDirA);
    registerProductionSession("session-engine-b", saveDirB);
    saveMonthlyReports(saveDirB, { reports: [entry(1)] });

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
