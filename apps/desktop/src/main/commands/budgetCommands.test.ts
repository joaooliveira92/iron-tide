import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  BudgetCommandOutcome,
  BudgetScreenProjection,
  SubmitBudgetAllocationPayload,
} from "../../shared/budget-contract.js";
import { clearCampaignSessionsForTest, registerCampaignSession } from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { clearPendingWorkspacesForTest } from "../pendingCommands.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import type { CommandProgram } from "../runtime/commandProgram.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import { inspectBudgetScreenProgram, submitBudgetAllocationProgram } from "./budgetCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_ARTIFACT = resolve(__dirname, "../../../../..", "content", "generated", "1880");

const runtime = ManagedRuntime.make(desktopMainLayer());

async function runProgram<A>(program: CommandProgram, payload: unknown): Promise<BridgeResult<A>> {
  return projectCommandExit(await runtime.runPromiseExit(program(payload))) as BridgeResult<A>;
}

const inspectBudgetScreen = (sessionId: string) =>
  runProgram<BudgetScreenProjection>(inspectBudgetScreenProgram, sessionId);
const submitBudgetAllocation = (payload: SubmitBudgetAllocationPayload) =>
  runProgram<BudgetCommandOutcome>(submitBudgetAllocationProgram, payload);
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);

describe("budget allocation", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-budget-"));
  });
  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    clearPendingWorkspacesForTest();
  });

  function registerSession(sessionId: string): CampaignState {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");
    const snapshot: CampaignSnapshot = structuredClone(output.state.snapshot);
    const state: CampaignState = {
      snapshot,
      envelope: createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot),
      rawHash: "",
    };
    const saveable = toSaveableState(state);
    const saveDir = resolve(saveRoot, sessionId);
    new SaveStore().save(saveable, saveDir);
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state: saveable,
    });
    return saveable;
  }

  const pay = (
    rate: number,
    research: number,
    over: { expectedRevision?: number; transportRequestId?: string } = {},
  ): SubmitBudgetAllocationPayload => ({
    sessionId: "b",
    expectedRevision: over.expectedRevision ?? 0,
    transportRequestId: over.transportRequestId ?? `req-${rate}-${research}`,
    appropriationRateBp: rate,
    researchBudget: research,
  });

  it("projects the player's current allocation with the engine's bounds", async () => {
    registerSession("b");
    const result = await inspectBudgetScreen("b");
    if (result.outcome !== "success") throw new Error(result.reason);
    expect(result.value.appropriationRateBp).toBeGreaterThan(0);
    expect(result.value.bounds).toEqual({
      appropriationRateMinBp: 500,
      appropriationRateMaxBp: 5000,
      researchBudgetMin: 0,
      researchBudgetMax: 1000,
    });
  });

  it("returns SESSION_NOT_FOUND for an unknown session", async () => {
    const inspect = await inspectBudgetScreen("no-such-session");
    expect(inspect).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
    const submit = await submitBudgetAllocation({
      ...pay(3000, 150),
      sessionId: "no-such-session",
    });
    expect(submit).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
  });

  it("rejects a malformed wire payload at the schema boundary", async () => {
    const malformed = await runProgram(submitBudgetAllocationProgram, {
      sessionId: "b",
      expectedRevision: 0,
      transportRequestId: "req-x",
      appropriationRateBp: 1.5,
      researchBudget: 10,
    });
    expect(malformed).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
  });

  it("rejects a stale expectedRevision without queueing", async () => {
    registerSession("b");
    const result = await submitBudgetAllocation(pay(3000, 150, { expectedRevision: 5 }));
    expect(result).toMatchObject({ outcome: "rejected", reason: "REVISION_MISMATCH" });
    if (result.outcome === "rejected") expect(result.currentRevision).toBe(0);
  });

  it("rejects an out-of-range allocation with the engine's code and queues nothing", async () => {
    registerSession("b");
    const result = await submitBudgetAllocation(pay(9000, 10));
    expect(result).toMatchObject({ outcome: "rejected", reason: "INVALID_COMMAND_PAYLOAD" });
  });

  it("queues a valid allocation and the engine applies it when the month is committed", async () => {
    registerSession("b");
    const queued = await submitBudgetAllocation(pay(3000, 15));
    expect(queued).toMatchObject({
      outcome: "success",
      value: { bodyType: "SetBudgetAllocation", appliedOnNextTurn: true },
    });
    const committed = await commitMonth({
      sessionId: "b",
      expectedRevision: 0,
      transportRequestId: "commit-0",
    });
    expect(committed.outcome).toBe("success");
    const after = await inspectBudgetScreen("b");
    if (after.outcome !== "success") throw new Error(after.reason);
    expect(after.value.appropriationRateBp).toBe(3000);
    expect(after.value.researchBudget).toBe(15);
  });

  it("refuses at issue time a research budget above the 12% cap and queues nothing", async () => {
    registerSession("b");
    const refused = await submitBudgetAllocation(pay(3000, 19));
    expect(refused).toMatchObject({ outcome: "rejected", reason: "RESEARCH_ABOVE_CAP" });
  });

  it("offers the engine's research cap for every selectable rate", async () => {
    registerSession("b");
    const view = await inspectBudgetScreen("b");
    if (view.outcome !== "success") throw new Error(view.reason);
    const caps = new Map(view.value.researchCaps.map((c) => [c.rateBp, c.cap]));
    expect(view.value.researchCaps).toHaveLength(91);
    expect(caps.get(2000)).toBe(12);
    expect(caps.get(3000)).toBe(18);
    expect(caps.get(500)).toBe(3);
  });

  it("replays the same transport request and rejects a conflicting body (idempotency)", async () => {
    registerSession("b");
    const first = await submitBudgetAllocation(pay(3000, 15, { transportRequestId: "req-idem" }));
    expect(first).toMatchObject({ outcome: "success" });
    const replay = await submitBudgetAllocation(pay(3000, 15, { transportRequestId: "req-idem" }));
    expect(replay).toMatchObject({ outcome: "success" });
    if (first.outcome === "success" && replay.outcome === "success") {
      expect(replay.value.commandId).toBe(first.value.commandId);
    }
    const conflict = await submitBudgetAllocation(
      pay(2500, 10, { transportRequestId: "req-idem" }),
    );
    expect(conflict).toMatchObject({ outcome: "rejected", reason: "IDEMPOTENCY_CONFLICT" });
  });
});
