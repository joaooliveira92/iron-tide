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
import type { BudgetScreenProjection } from "../../shared/budget-contract.js";
import type { InspectCampaignResult } from "../../shared/campaign-contract.js";
import type { ConstructionCommandQueuedOutcome } from "../../shared/construction-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { inspectBudgetScreenProgram } from "./budgetCommands.js";
import { commitMonthProgram } from "./commitMonth.js";
import { orderConstructionBatchCommandProgram } from "./constructionStatusCommands.js";
import { inspectCampaignProgram } from "./inspectCampaign.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_ARTIFACT = resolve(__dirname, "../../../../..", "content", "generated", "1880");

const CONSTRUCTION_APPROPRIATION = "Proportional appropriation to construction projects";

const makeRuntime = () => ManagedRuntime.make(desktopMainLayer());
let runtime = makeRuntime();

function restartRuntime(): void {
  void runtime.dispose();
  runtime = makeRuntime();
}

async function runProgram<A>(
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<A>> {
  return projectCommandExit(
    await runtime.runPromiseExit(programFor(program)(payload)),
  ) as BridgeResult<A>;
}

function expectSuccess<A>(result: BridgeResult<A>): A {
  if (result.outcome !== "success") throw new Error(JSON.stringify(result));
  return result.value;
}

describe("the pre-turn forecast sees construction ordered this turn", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-queued-forecast-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    restartRuntime();
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

  const plannedConstruction = async (sessionId: string) =>
    expectSuccess<InspectCampaignResult>(await runProgram(inspectCampaignProgram, sessionId))
      .projection.economy.plannedConstruction;

  const budgetDrawTotal = async (sessionId: string) =>
    expectSuccess<BudgetScreenProjection>(await runProgram(inspectBudgetScreenProgram, sessionId))
      .commitments.construction.drawTotal;

  async function orderBatch(sessionId: string, quantity: number): Promise<void> {
    const record = getCampaignSession(sessionId)!;
    const design = [...record.state.snapshot.designs.values()].find(
      (d) => d.nationId === "uk" && Number(d.normalizedDisplacementKg) <= 11_000_000,
    );
    if (!design) throw new Error("no orderable uk design in the production pack");
    expectSuccess<ConstructionCommandQueuedOutcome>(
      await runProgram(orderConstructionBatchCommandProgram, {
        sessionId,
        expectedRevision: Number(record.state.snapshot.turnNumber),
        transportRequestId: `req-order-${String(quantity)}`,
        designVersionId: design.designVersionId,
        quantity,
      }),
    );
  }

  async function chargedConstruction(sessionId: string): Promise<number> {
    const record = getCampaignSession(sessionId)!;
    const committed = expectSuccess<CommitMonthResponse>(
      await runProgram(commitMonthProgram, {
        sessionId,
        expectedRevision: Number(record.state.snapshot.turnNumber),
        transportRequestId: "req-commit",
      }),
    );
    return committed.financialLedger
      .filter((entry) => entry.description === CONSTRUCTION_APPROPRIATION)
      .reduce((sum, entry) => sum - entry.amount, 0);
  }

  it("forecasts the month's construction charge once an order is queued", async () => {
    registerSession("with-order");
    const before = await plannedConstruction("with-order");
    await orderBatch("with-order", 2);
    const forecast = await plannedConstruction("with-order");
    const charged = await chargedConstruction("with-order");

    expect(forecast).toBe(charged);
    expect(forecast).toBeGreaterThan(before);
  });

  it("reconciles the budget screen's construction draws with the same forecast", async () => {
    registerSession("budget");
    await orderBatch("budget", 2);
    expect(await budgetDrawTotal("budget")).toBe(await plannedConstruction("budget"));
  });
});
