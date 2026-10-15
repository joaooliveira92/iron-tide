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
  AuthorizeDockExpansionCommandPayload,
  CancelConstructionProjectCommandPayload,
  ConstructionCommandQueuedOutcome,
  HaltConstructionCommandPayload,
  OrderConstructionBatchCommandPayload,
  PlaceForeignConstructionCommandPayload,
  ResumeConstructionCommandPayload,
  SetAccelerationCommandPayload,
} from "../../shared/construction-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { pendingEnvelopesForExecution, clearPendingWorkspacesForTest } from "../pendingCommands.js";
import { toSaveableState } from "../saveHelpers.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import type { CommandProgram } from "../runtime/commandProgram.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { commitMonthProgram } from "./commitMonth.js";
import {
  authorizeDockExpansionCommandProgram,
  cancelConstructionProjectCommandProgram,
  haltConstructionCommandProgram,
  orderConstructionBatchCommandProgram,
  placeForeignConstructionCommandProgram,
  resumeConstructionCommandProgram,
  setAccelerationCommandProgram,
} from "./constructionStatusCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

// One shared runtime for every steering command; the services delegate to the
// same in-memory session/queue registries the tests populate directly.
const runtime = ManagedRuntime.make(desktopMainLayer());

/** Runs a command program through the desktop service graph and projects its wire envelope. */
async function runProgram<A>(program: CommandProgram, payload: unknown): Promise<BridgeResult<A>> {
  return projectCommandExit(await runtime.runPromiseExit(program(payload))) as BridgeResult<A>;
}

const haltConstructionCommand = (payload: HaltConstructionCommandPayload) =>
  runProgram<ConstructionCommandQueuedOutcome>(haltConstructionCommandProgram, payload);
const resumeConstructionCommand = (payload: ResumeConstructionCommandPayload) =>
  runProgram<ConstructionCommandQueuedOutcome>(resumeConstructionCommandProgram, payload);
const setAccelerationCommand = (payload: SetAccelerationCommandPayload) =>
  runProgram<ConstructionCommandQueuedOutcome>(setAccelerationCommandProgram, payload);
const cancelConstructionProjectCommand = (payload: CancelConstructionProjectCommandPayload) =>
  runProgram<ConstructionCommandQueuedOutcome>(cancelConstructionProjectCommandProgram, payload);
const orderConstructionBatchCommand = (payload: OrderConstructionBatchCommandPayload) =>
  runProgram<ConstructionCommandQueuedOutcome>(orderConstructionBatchCommandProgram, payload);
const authorizeDockExpansionCommand = (payload: AuthorizeDockExpansionCommandPayload) =>
  runProgram<ConstructionCommandQueuedOutcome>(authorizeDockExpansionCommandProgram, payload);
const placeForeignConstructionCommand = (payload: PlaceForeignConstructionCommandPayload) =>
  runProgram<ConstructionCommandQueuedOutcome>(placeForeignConstructionCommandProgram, payload);
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);

/**
 * End-to-end reachability proof for the construction steering commands (SB3-R5/R8/R11/R16): each issues a real engine
 * command envelope against the production pack and applies ONLY through `commitMonth`'s `command_collection`, so the
 * engine — not the desktop — is the sole mutator. Deleting the command wiring makes these fail.
 */
describe("construction status commands (end-to-end)", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-construction-status-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    clearPendingWorkspacesForTest();
  });

  function registerProductionSession(
    sessionId: string,
    saveDir: string,
    patch?: (snapshot: CampaignSnapshot) => void,
  ): CampaignState {
    const signal = new AbortController().signal;
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(GENERATED_ARTIFACT, signal, collector);
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");

    const snapshot = structuredClone(output.state.snapshot);
    if (patch) patch(snapshot);
    const state: CampaignState = {
      snapshot,
      envelope: createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot),
      rawHash: "",
    };
    const saveable = toSaveableState(state);
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

  async function commit(sessionId: string): Promise<void> {
    const record = getCampaignSession(sessionId);
    if (!record) throw new Error("session missing");
    const result = await commitMonth({
      sessionId,
      expectedRevision: Number(record.state.snapshot.turnNumber),
      transportRequestId: `commit-${sessionId}`,
    });
    expect(result.outcome, JSON.stringify(result.diagnostics)).toBe("success");
  }

  it("halts a project through the queue and the monthly command phase", async () => {
    const sessionId = "s-halt";
    registerProductionSession(sessionId, resolve(saveRoot, "save"), (snapshot) => {
      const uk = snapshot.nations.get("uk");
      if (!uk || uk.constructionProjects.length === 0)
        throw new Error("production pack has no uk construction project");
      // ACTIVE is a state production reaches routinely (`PLANNED -> ACTIVE`).
      uk.constructionProjects[0]!.status = "ACTIVE";
    });
    const record = getCampaignSession(sessionId)!;
    const projectId = record.state.snapshot.nations.get("uk")!.constructionProjects[0]!.id;

    const issued = await haltConstructionCommand({
      sessionId,
      expectedRevision: Number(record.state.snapshot.turnNumber),
      transportRequestId: "req-halt",
      projectId,
    });
    expect(issued.outcome).toBe("success");
    if (issued.outcome !== "success") return;
    expect(issued.value.bodyType).toBe("HaltConstruction");

    // The command is queued, not yet applied.
    const queued = pendingEnvelopesForExecution(sessionId, record.state.snapshot);
    expect(queued.map((e) => e.body.type)).toContain("HaltConstruction");

    await commit(sessionId);

    const after = getCampaignSession(sessionId)!;
    const project = after.state.snapshot.nations
      .get("uk")!
      .constructionProjects.find((p) => p.id === projectId);
    expect(project?.status).toBe("HALTED");
  });

  it("resumes and accelerates a project after a halt", async () => {
    const sessionId = "s-accel";
    registerProductionSession(sessionId, resolve(saveRoot, "save"), (snapshot) => {
      const uk = snapshot.nations.get("uk");
      if (!uk || uk.constructionProjects.length === 0) throw new Error("no uk project");
      uk.constructionProjects[0]!.status = "ACTIVE";
    });
    const record = getCampaignSession(sessionId)!;
    const projectId = record.state.snapshot.nations.get("uk")!.constructionProjects[0]!.id;

    const accelerated = await setAccelerationCommand({
      sessionId,
      expectedRevision: Number(record.state.snapshot.turnNumber),
      transportRequestId: "req-accel",
      projectId,
      accelerated: true,
    });
    expect(accelerated.outcome).toBe("success");
    await commit(sessionId);

    const after = getCampaignSession(sessionId)!;
    const project = after.state.snapshot.nations
      .get("uk")!
      .constructionProjects.find((p) => p.id === projectId);
    expect(project?.status).toBe("ACCELERATED");

    const halted = await haltConstructionCommand({
      sessionId,
      expectedRevision: Number(after.state.snapshot.turnNumber),
      transportRequestId: "req-halt-2",
      projectId,
    });
    expect(halted.outcome).toBe("success");
    await commit(sessionId);
    const resumed = await resumeConstructionCommand({
      sessionId,
      expectedRevision: Number(getCampaignSession(sessionId)!.state.snapshot.turnNumber),
      transportRequestId: "req-resume",
      projectId,
    });
    expect(resumed.outcome).toBe("success");
  });

  it("orders a class-order batch that appears as projects after the month", async () => {
    const sessionId = "s-batch";
    registerProductionSession(sessionId, resolve(saveRoot, "save"));
    const record = getCampaignSession(sessionId)!;
    const design = [...record.state.snapshot.designs.values()].find(
      (d) => d.nationId === "uk" && Number(d.normalizedDisplacementKg) <= 11_000_000,
    );
    if (!design) throw new Error("no orderable uk design in the production pack");

    const issued = await orderConstructionBatchCommand({
      sessionId,
      expectedRevision: Number(record.state.snapshot.turnNumber),
      transportRequestId: "req-batch",
      designVersionId: design.designVersionId,
      quantity: 2,
    });
    expect(issued.outcome).toBe("success");
    if (issued.outcome !== "success") return;
    expect(issued.value.bodyType).toBe("OrderConstruction");

    await commit(sessionId);

    const after = getCampaignSession(sessionId)!;
    const added = after.state.snapshot.nations
      .get("uk")!
      .constructionProjects.filter((p) => p.designVersionId === design.designVersionId);
    expect(added.length).toBeGreaterThanOrEqual(2);
  });

  it("authorizes a dock expansion that appears as an INFRASTRUCTURE project", async () => {
    const sessionId = "s-dock";
    registerProductionSession(sessionId, resolve(saveRoot, "save"));
    const record = getCampaignSession(sessionId)!;

    const issued = await authorizeDockExpansionCommand({
      sessionId,
      expectedRevision: Number(record.state.snapshot.turnNumber),
      transportRequestId: "req-dock",
      possessionId: "pos-1",
    });
    expect(issued.outcome).toBe("success");
    if (issued.outcome !== "success") return;
    expect(issued.value.bodyType).toBe("AuthorizeDockExpansion");

    await commit(sessionId);

    const after = getCampaignSession(sessionId)!;
    const expansions = after.state.snapshot.nations
      .get("uk")!
      .constructionProjects.filter((p) => p.projectType === "INFRASTRUCTURE");
    expect(expansions.length).toBeGreaterThanOrEqual(1);
  });

  it("cancels a project through the queue and settles it in the monthly command phase", async () => {
    const sessionId = "s-cancel";
    registerProductionSession(sessionId, resolve(saveRoot, "save"), (snapshot) => {
      const uk = snapshot.nations.get("uk");
      if (!uk || uk.constructionProjects.length === 0) throw new Error("no uk project");
      uk.constructionProjects[0]!.status = "ACTIVE";
    });
    const record = getCampaignSession(sessionId)!;
    const projectId = record.state.snapshot.nations.get("uk")!.constructionProjects[0]!.id;

    const issued = await cancelConstructionProjectCommand({
      sessionId,
      expectedRevision: Number(record.state.snapshot.turnNumber),
      transportRequestId: "req-cancel-project",
      projectId,
    });
    expect(issued.outcome).toBe("success");
    if (issued.outcome !== "success") return;
    expect(issued.value.bodyType).toBe("CancelConstructionProject");

    // Queued, not yet applied.
    const queued = pendingEnvelopesForExecution(sessionId, record.state.snapshot);
    expect(queued.map((e) => e.body.type)).toContain("CancelConstructionProject");

    await commit(sessionId);

    const after = getCampaignSession(sessionId)!;
    const project = after.state.snapshot.nations
      .get("uk")!
      .constructionProjects.find((p) => p.id === projectId);
    expect(project?.status).toBe("CANCELLED");
  });

  it("places a foreign order through the queue and records the contract after the month", async () => {
    const sessionId = "s-foreign";
    registerProductionSession(sessionId, resolve(saveRoot, "save"));
    const record = getCampaignSession(sessionId)!;
    const design = [...record.state.snapshot.designs.values()].find(
      (d) => d.nationId === "uk" && Number(d.normalizedDisplacementKg) <= 10_000_000,
    );
    if (!design) throw new Error("no orderable uk design in the production pack");

    const issued = await placeForeignConstructionCommand({
      sessionId,
      expectedRevision: Number(record.state.snapshot.turnNumber),
      transportRequestId: "req-foreign",
      designVersionId: design.designVersionId,
      builderNationId: "france",
      quantity: 1,
    });
    expect(issued.outcome).toBe("success");
    if (issued.outcome !== "success") return;
    expect(issued.value.bodyType).toBe("OrderForeignConstruction");

    await commit(sessionId);

    const after = getCampaignSession(sessionId)!;
    const uk = after.state.snapshot.nations.get("uk")!;
    expect(uk.foreignContracts ?? []).toHaveLength(1);
    expect(uk.constructionProjects.some((p) => p.foreignBuilderNationId === "france")).toBe(true);
  });

  it("rejects a foreign-order payload carrying contract terms beyond the wire schema (INVALID_PAYLOAD)", async () => {
    const result = await runProgram(placeForeignConstructionCommandProgram, {
      sessionId: "s-strict",
      expectedRevision: 0,
      transportRequestId: "req-strict",
      designVersionId: "des_gbr_inflexible",
      builderNationId: "france",
      quantity: 1,
      // The renderer must never supply contract terms: `withStrictSchema` rejects
      // the excess key at the IPC boundary before any service is resolved.
      terms: { price: 1 },
    });
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.reason).toBe("INVALID_PAYLOAD");
  });
});
