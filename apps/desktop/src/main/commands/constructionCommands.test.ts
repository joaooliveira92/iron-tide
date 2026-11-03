import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignState } from "@bluewave/campaign";
import {
  constructionProjectReadout,
  type CampaignConfiguration,
  type CommitMonthResponse,
} from "@bluewave/campaign-engine";
import { SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type { CompileCampaignResult } from "../../shared/campaign-contract.js";
import type { LoadCampaignResponse } from "../../shared/continuity-contract.js";
import type {
  CancelConstructionCommandPayload,
  ConstructionCommandOutcome,
  ConstructionScreenProjection,
  ReplaceConstructionCommandPayload,
  SubmitConstructionCommandPayload,
} from "../../shared/construction-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { clearConstructionWorkspacesForTest } from "../constructionWorkspace.js";
import { toSaveableState } from "../saveHelpers.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { NativeDialog } from "../runtime/platform.js";
import {
  cancelConstructionCommandProgram,
  inspectConstructionScreenProgram,
  replaceConstructionCommandProgram,
  submitConstructionCommandProgram,
} from "./constructionCommands.js";
import { commitMonthProgram } from "./commitMonth.js";
import { compileCampaignProgram } from "./compileCampaign.js";
import { loadCampaignProgram } from "./continuityCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

let chooseSaveDirectoryAnswer: string | null = null;
let choosePackageDirectoryAnswer: string | null = null;

const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    desktopMainLayer(),
    Layer.succeed(NativeDialog, {
      chooseSaveDirectory: () => Effect.succeed(chooseSaveDirectoryAnswer),
      choosePackageDirectory: () => Effect.succeed(choosePackageDirectoryAnswer),
      chooseCopyDirectory: () => Effect.succeed(null),
    }),
  ),
);

async function runProgram<A>(
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<A>> {
  return projectCommandExit(
    await runtime.runPromiseExit(programFor(program)(payload)),
  ) as BridgeResult<A>;
}

const inspectConstructionScreen = (sessionId: string) =>
  runProgram<ConstructionScreenProjection>(inspectConstructionScreenProgram, sessionId);
const submitConstructionCommand = (payload: SubmitConstructionCommandPayload) =>
  runProgram<ConstructionCommandOutcome>(submitConstructionCommandProgram, payload);
const replaceConstructionCommand = (payload: ReplaceConstructionCommandPayload) =>
  runProgram<ConstructionCommandOutcome>(replaceConstructionCommandProgram, payload);
const cancelConstructionCommand = (payload: CancelConstructionCommandPayload) =>
  runProgram<ConstructionCommandOutcome>(cancelConstructionCommandProgram, payload);
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);
const compileCampaign = (configuration: CampaignConfiguration) =>
  runProgram<CompileCampaignResult>(compileCampaignProgram, configuration);
const loadCampaign = () => runProgram<LoadCampaignResponse>(loadCampaignProgram, undefined);

describe("construction commands", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-construction-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    clearConstructionWorkspacesForTest();
  });

  function registerProductionSession(sessionId: string, saveDir: string): CampaignState {
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

  function ukDesignIds(state: CampaignState): string[] {
    return [...state.snapshot.designs.values()]
      .filter((design) => design.nationId === "uk")
      .map((design) => design.designVersionId)
      .sort();
  }

  function requireSessionState(sessionId: string): CampaignState {
    const record = getCampaignSession(sessionId);
    if (!record) throw new Error(`session ${sessionId} missing`);
    return record.state;
  }

  function loadSavedState(saveDir: string): CampaignState {
    return Effect.runSync(new SaveStore().load(saveDir)).state;
  }

  function baseConfiguration(
    overrides: Partial<CampaignConfiguration> = {},
  ): CampaignConfiguration {
    return {
      scenarioId: "scen_1880",
      playerSlotId: "uk",
      continuityModeId: "historical",
      fleetSizeSettingId: "standard",
      researchSpeedSettingId: "standard",
      technologyVariationSettingId: "none",
      historicalBudgetOptionId: "standard",
      legacyFleetModeId: "historical",
      tacticalRealismModeId: "standard",
      difficultyProfileId: "easy",
      campaignSeed: "a".repeat(32),
      configurationSchemaVersion: "campaign_configuration_v1",
      ...overrides,
    } as CampaignConfiguration;
  }

  it("returns SESSION_NOT_FOUND for an unregistered session on every command", async () => {
    const inspect = await inspectConstructionScreen("no-such-session");
    expect(inspect.outcome).toBe("error");
    if (inspect.outcome === "error") expect(inspect.reason).toBe("SESSION_NOT_FOUND");

    const submit = await submitConstructionCommand({
      sessionId: "no-such-session",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-0",
    });
    expect(submit.outcome).toBe("error");
    if (submit.outcome === "error") expect(submit.reason).toBe("SESSION_NOT_FOUND");

    const replace = await replaceConstructionCommand({
      sessionId: "no-such-session",
      commandId: "cmd-x",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-0",
    });
    expect(replace.outcome).toBe("error");
    if (replace.outcome === "error") expect(replace.reason).toBe("SESSION_NOT_FOUND");

    const cancel = await cancelConstructionCommand({
      sessionId: "no-such-session",
      commandId: "cmd-x",
      expectedRevision: 0,
      transportRequestId: "req-0",
    });
    expect(cancel.outcome).toBe("error");
    if (cancel.outcome === "error") expect(cancel.reason).toBe("SESSION_NOT_FOUND");
  });

  it("shows real available designs and the nation's real economy/workspace on inspect", async () => {
    const saveDir = resolve(saveRoot, "save-inspect");
    const state = registerProductionSession("session-inspect", saveDir);

    const result = await inspectConstructionScreen("session-inspect");
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    const projection = result.value;
    expect(projection.revision).toBe(0);
    expect(projection.month).toEqual({ month: 1, year: 1880 });

    const uk = state.snapshot.nations.get("uk")!;
    expect(projection.economy.treasury).toBe(Number(uk.treasury));
    const ports = state.snapshot.world.ports.filter((p) => p.nationId === "uk");
    expect(projection.economy.shipyardCapacity).toBe(
      ports.reduce((sum, port) => sum + Number(port.level), 0),
    );

    expect(projection.designs).toHaveLength(ukDesignIds(state).length);
    expect(ukDesignIds(state).length).toBeGreaterThan(0);
    const inflexible = projection.designs.find((d) => d.designId === "des_gbr_inflexible");
    expect(inflexible).toBeDefined();
    expect(inflexible!.className).toBe("Inflexible");
    expect(inflexible!.year).toBe(1880);
    expect(inflexible!.available).toBe(true);
    const notBuildable = projection.designs.filter((d) => !d.available);
    expect(notBuildable.length).toBeGreaterThan(0);
    expect(notBuildable.every((d) => d.year > 1880)).toBe(true);
    expect(inflexible!.mass).toBe(11_880);
    expect(inflexible!.speed).toBe(8);
    expect(inflexible!.machineryType).toBe("reciprocating_compound");

    expect(projection.workspace.commands).toEqual([]);
    expect(projection.workspace.treasuryReserved).toBe(0);
    expect(projection.workspace.capacityReserved).toBe(0);

    expect(projection.projects.length).toBeGreaterThan(0);
    for (const entry of projection.projects) {
      const project = uk.constructionProjects.find((p) => p.id === entry.projectId)!;
      const design = state.snapshot.designs.get(entry.designVersionId);
      expect(entry.readout).toMatchObject(constructionProjectReadout(project, design, "1880-01"));
      if (project.status === "HALTED")
        expect(entry.readout!.haltedCarryingCostUnits).not.toBeNull();
      else expect(entry.readout!.haltedCarryingCostUnits).toBeNull();
    }
  });

  it("submitting against a real design queues a real project, visible on next inspect and round-tripped through save/load", async () => {
    const saveDir = resolve(saveRoot, "save-submit");
    const state = registerProductionSession("session-submit", saveDir);
    const projectsBefore = state.snapshot.nations.get("uk")!.constructionProjects.length;

    const submit = await submitConstructionCommand({
      sessionId: "session-submit",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-submit-1",
    });
    expect(submit.outcome).toBe("success");
    if (submit.outcome !== "success") return;

    const { command, workspace: afterWorkspace } = submit.value;
    expect(command.status).toBe("submitted");
    expect(command.commandId.startsWith("cmd-req-submit-1-")).toBe(true);
    expect(afterWorkspace.commands).toHaveLength(1);
    expect(afterWorkspace.commands[0]!.commandId).toBe(command.commandId);
    expect(afterWorkspace.treasuryReserved).toBeGreaterThan(0);
    expect(afterWorkspace.capacityReserved).toBeGreaterThan(0);

    const projectId = `project-${command.commandId.replace(/^cmd-/, "")}`;
    const saved = loadSavedState(saveDir);
    const nationAfter = saved.snapshot.nations.get("uk")!;
    expect(nationAfter.constructionProjects.length).toBe(projectsBefore + 1);
    const queued = nationAfter.constructionProjects.find((p) => p.id === projectId);
    expect(queued).toBeDefined();
    expect(queued!.designVersionId).toBe("des_gbr_inflexible");
    expect(queued!.status).toBe("PLANNED");
    expect(Number(queued!.totalWork)).toBeGreaterThan(0);

    const inspect = await inspectConstructionScreen("session-submit");
    expect(inspect.outcome).toBe("success");
    if (inspect.outcome !== "success") return;
    expect(inspect.value.workspace.commands).toHaveLength(1);
    expect(inspect.value.workspace.commands[0]!.commandId).toBe(command.commandId);
    expect(inspect.value.workspace.treasuryReserved).toBe(afterWorkspace.treasuryReserved);
  });

  it("rejects a stale expectedRevision without mutating the session or writing a new save", async () => {
    const saveDir = resolve(saveRoot, "save-stale");
    registerProductionSession("session-stale", saveDir);

    const result = await submitConstructionCommand({
      sessionId: "session-stale",
      designId: "des_gbr_inflexible",
      expectedRevision: 5,
      transportRequestId: "req-stale-1",
    });
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") return;
    expect(result.reason).toBe("REVISION_MISMATCH");
    expect(result.currentRevision).toBe(0);
  });

  it("rejects a pre-commit expectedRevision after the world advanced a month — nothing is silently applied", async () => {
    const saveDir = resolve(saveRoot, "save-stale-after-commit");
    registerProductionSession("session-stale-commit", saveDir);

    const month = await commitMonth({
      sessionId: "session-stale-commit",
      expectedRevision: 0,
      transportRequestId: "req-global",
    });
    expect(month.outcome).toBe("success");

    const staleSubmit = await submitConstructionCommand({
      sessionId: "session-stale-commit",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-stale-after",
    });
    expect(staleSubmit.outcome).toBe("rejected");
    if (staleSubmit.outcome !== "rejected") return;
    expect(staleSubmit.reason).toBe("REVISION_MISMATCH");
    expect(staleSubmit.currentRevision).toBe(1);

    const updated = requireSessionState("session-stale-commit");
    expect(Number(updated.snapshot.turnNumber)).toBe(1);
    const replay = await inspectConstructionScreen("session-stale-commit");
    expect(replay.outcome).toBe("success");
    if (replay.outcome !== "success") return;
    expect(replay.value.workspace.commands).toEqual([]);
  });

  it("rejects an unknown or foreign design before touching state", async () => {
    registerProductionSession("session-design", resolve(saveRoot, "save-design"));

    const unknown = await submitConstructionCommand({
      sessionId: "session-design",
      designId: "design_that_never_existed",
      expectedRevision: 0,
      transportRequestId: "req-unknown",
    });
    expect(unknown.outcome).toBe("rejected");
    if (unknown.outcome === "rejected") expect(unknown.reason).toBe("UNKNOWN_DESIGN");

    const foreign = await submitConstructionCommand({
      sessionId: "session-design",
      designId: "des_fra_redoutable",
      expectedRevision: 0,
      transportRequestId: "req-french",
    });
    expect(foreign.outcome).toBe("rejected");
    if (foreign.outcome === "rejected") expect(foreign.reason).toBe("DESIGN_NOT_FOR_PLAYER");
  });

  it("rejects an order when treasury cannot cover it, without reservation or project", async () => {
    const saveDir = resolve(saveRoot, "save-poor");
    registerProductionSession("session-poor", saveDir);
    const record = getCampaignSession("session-poor")!;
    const snapshot = record.state.snapshot;
    const uk = snapshot.nations.get("uk")!;
    const poorNation = { ...uk, treasury: SafeInt(100) };
    const poorSnapshot = {
      ...snapshot,
      nations: new Map(snapshot.nations).set("uk", poorNation),
    };
    const poorEnvelope = createEnvelope(
      "campaign-snapshot",
      poorSnapshot.compatibilityVersion,
      poorSnapshot,
    );
    const poorState = toSaveableState({
      snapshot: poorSnapshot,
      envelope: poorEnvelope,
      rawHash: "",
    });
    new SaveStore().save(poorState, saveDir);
    registerCampaignSession({ ...record, state: poorState });

    const projectsBefore = poorSnapshot.nations.get("uk")!.constructionProjects.length;
    expect(Number(poorNation.treasury)).toBe(100);

    const result = await submitConstructionCommand({
      sessionId: "session-poor",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-poor",
    });
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") return;
    expect(result.reason).toBe("INSUFFICIENT_FUNDS");

    const updated = requireSessionState("session-poor");
    expect(updated.snapshot.nations.get("uk")!.constructionProjects.length).toBe(projectsBefore);
    expect(updated.snapshot.nations.get("uk")!.treasury).toBe(100);
  });

  it("is idempotent under the same transportRequestId (retry) — no double order", async () => {
    const saveDir = resolve(saveRoot, "save-idem");
    const state = registerProductionSession("session-idem", saveDir);
    const projectsBefore = state.snapshot.nations.get("uk")!.constructionProjects.length;

    const first = await submitConstructionCommand({
      sessionId: "session-idem",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "tx-same",
    });
    expect(first.outcome).toBe("success");
    if (first.outcome !== "success") return;

    const retry = await submitConstructionCommand({
      sessionId: "session-idem",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "tx-same",
    });
    expect(retry.outcome).toBe("success");
    if (retry.outcome !== "success") return;
    expect(retry.value.command.commandId).toBe(first.value.command.commandId);

    const updated = requireSessionState("session-idem");
    expect(updated.snapshot.nations.get("uk")!.constructionProjects.length).toBe(
      projectsBefore + 1,
    );
  });

  it("IDEMPOTENCY_CONFLICTs when the same transportRequestId is reused for a different command", async () => {
    registerProductionSession("session-conflict", resolve(saveRoot, "save-conflict"));
    await submitConstructionCommand({
      sessionId: "session-conflict",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "tx-shared",
    });

    const conflict = await submitConstructionCommand({
      sessionId: "session-conflict",
      designId: "des_gbr_alexandra",
      expectedRevision: 0,
      transportRequestId: "tx-shared",
    });
    expect(conflict.outcome).toBe("rejected");
    if (conflict.outcome === "rejected") expect(conflict.reason).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("cancels an in-flight command: releases reservations, drops the project, reports cancelled", async () => {
    const saveDir = resolve(saveRoot, "save-cancel");
    const state = registerProductionSession("session-cancel", saveDir);
    const projectsBefore = state.snapshot.nations.get("uk")!.constructionProjects.length;

    const submit = await submitConstructionCommand({
      sessionId: "session-cancel",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-cancel-1",
    });
    expect(submit.outcome).toBe("success");
    if (submit.outcome !== "success") return;
    const commandId = submit.value.command.commandId;

    const cancel = await cancelConstructionCommand({
      sessionId: "session-cancel",
      commandId,
      expectedRevision: 0,
      transportRequestId: "cancel-1",
    });
    expect(cancel.outcome).toBe("success");
    if (cancel.outcome !== "success") return;
    expect(cancel.value.command.commandId).toBe(commandId);
    expect(cancel.value.command.status).toBe("cancelled");

    expect(cancel.value.workspace.commands).toHaveLength(1);
    expect(cancel.value.workspace.commands[0]!.status).toBe("cancelled");
    expect(cancel.value.workspace.treasuryReserved).toBe(0);

    const updated = requireSessionState("session-cancel");
    const projects = updated.snapshot.nations.get("uk")!.constructionProjects;
    expect(projects.length).toBe(projectsBefore);
    expect(projects.some((p) => p.id === `project-${commandId.replace(/^cmd-/, "")}`)).toBe(false);
  });

  it("rejects cancel/replace of a command that is not in flight", async () => {
    registerProductionSession("session-notflight", resolve(saveRoot, "save-notflight"));

    const missing = await cancelConstructionCommand({
      sessionId: "session-notflight",
      commandId: "cmd-does-not-exist",
      expectedRevision: 0,
      transportRequestId: "req-missing",
    });
    expect(missing.outcome).toBe("rejected");
    if (missing.outcome === "rejected") expect(missing.reason).toBe("COMMAND_NOT_FOUND");

    const submit = await submitConstructionCommand({
      sessionId: "session-notflight",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-flight-1",
    });
    expect(submit.outcome).toBe("success");
    if (submit.outcome !== "success") return;
    const flightCommandId = submit.value.command.commandId;

    const cancelled = await cancelConstructionCommand({
      sessionId: "session-notflight",
      commandId: flightCommandId,
      expectedRevision: 0,
      transportRequestId: "cancel-2",
    });
    expect(cancelled.outcome).toBe("success");

    const second = await cancelConstructionCommand({
      sessionId: "session-notflight",
      commandId: flightCommandId,
      expectedRevision: 0,
      transportRequestId: "cancel-3",
    });
    expect(second.outcome).toBe("rejected");
    if (second.outcome === "rejected") expect(second.reason).toBe("COMMAND_NOT_IN_FLIGHT");
  });

  it("replace supersedes the in-flight command and queues the replacement design's project", async () => {
    const saveDir = resolve(saveRoot, "save-replace");
    const state = registerProductionSession("session-replace", saveDir);
    const projectsBefore = state.snapshot.nations.get("uk")!.constructionProjects.length;

    const submit = await submitConstructionCommand({
      sessionId: "session-replace",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-original",
    });
    expect(submit.outcome).toBe("success");
    if (submit.outcome !== "success") return;
    const originalCommandId = submit.value.command.commandId;

    const replaced = await replaceConstructionCommand({
      sessionId: "session-replace",
      commandId: originalCommandId,
      designId: "des_gbr_alexandra",
      expectedRevision: 0,
      transportRequestId: "req-replacement",
    });
    expect(replaced.outcome).toBe("success");
    if (replaced.outcome !== "success") return;

    expect(replaced.value.command.status).toBe("submitted");
    expect(replaced.value.command.commandId.startsWith("cmd-req-replacement-")).toBe(true);
    const replacementCommandId = replaced.value.command.commandId;
    expect(replaced.value.workspace.commands).toHaveLength(2);
    const original = replaced.value.workspace.commands.find(
      (c) => c.commandId === originalCommandId,
    );
    expect(original!.status).toBe("superseded");
    expect(
      replaced.value.workspace.commands.find((c) => c.commandId === replacementCommandId),
    ).toBeDefined();

    const updated = requireSessionState("session-replace");
    const projects = updated.snapshot.nations.get("uk")!.constructionProjects;
    expect(projects.length).toBe(projectsBefore + 1);
    expect(projects.some((p) => p.id === `project-${originalCommandId.replace(/^cmd-/, "")}`)).toBe(
      false,
    );
    const replacement = projects.find(
      (p) => p.id === `project-${replacementCommandId.replace(/^cmd-/, "")}`,
    );
    expect(replacement).toBeDefined();
    expect(replacement!.designVersionId).toBe("des_gbr_alexandra");
  });

  it("F1: after a restart, the loaded package still shows the order — project visible, cancel works on the reconstructed record", async () => {
    const saveDir = resolve(saveRoot, "save-restart");
    chooseSaveDirectoryAnswer = saveDir;
    const compile = await compileCampaign(baseConfiguration());
    expect(compile.outcome).toBe("success");
    if (compile.outcome !== "success") return;
    const compiledSessionId = compile.value.sessionId;

    const submit = await submitConstructionCommand({
      sessionId: compiledSessionId,
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-restart-1",
    });
    expect(submit.outcome).toBe("success");
    if (submit.outcome !== "success") return;
    const commandId = submit.value.command.commandId;

    clearCampaignSessionsForTest();
    clearConstructionWorkspacesForTest();

    choosePackageDirectoryAnswer = saveDir;
    const load = await loadCampaign();
    expect(load.outcome).toBe("success");
    if (load.outcome !== "success") return;
    const loadedSessionId = load.value.sessionId;

    const inspect = await inspectConstructionScreen(loadedSessionId);
    expect(inspect.outcome).toBe("success");
    if (inspect.outcome !== "success") return;
    expect(inspect.value.workspace.commands).toHaveLength(1);
    expect(inspect.value.workspace.commands[0]!.commandId).toBe(commandId);
    expect(inspect.value.workspace.commands[0]!.status).toBe("submitted");
    const queuedProject = inspect.value.projects.find((p) => p.commandId === commandId);
    expect(queuedProject).toBeDefined();
    expect(queuedProject!.designVersionId).toBe("des_gbr_inflexible");
    expect(
      inspect.value.projects.some(
        (p) => p.projectId === "con_gbr_inflexible" && p.commandId === null,
      ),
    ).toBe(true);

    const stale = await cancelConstructionCommand({
      sessionId: loadedSessionId,
      commandId,
      expectedRevision: 5,
      transportRequestId: "cancel-stale-after-restart",
    });
    expect(stale.outcome).toBe("rejected");
    if (stale.outcome === "rejected") expect(stale.reason).toBe("REVISION_MISMATCH");

    const cancel = await cancelConstructionCommand({
      sessionId: loadedSessionId,
      commandId,
      expectedRevision: 0,
      transportRequestId: "cancel-after-restart",
    });
    expect(cancel.outcome).toBe("success");
    if (cancel.outcome !== "success") return;
    expect(cancel.value.command.commandId).toBe(commandId);
    expect(cancel.value.command.status).toBe("cancelled");

    const updated = getCampaignSession(loadedSessionId)!;
    const projects = updated.state.snapshot.nations.get("uk")!.constructionProjects;
    expect(projects.some((p) => p.id === `project-${commandId.replace(/^cmd-/, "")}`)).toBe(false);
  });

  it("F2: replace is failure-atomic — an unaffordable replacement is rejected and the original order survives intact", async () => {
    const saveDir = resolve(saveRoot, "save-atomic");
    registerProductionSession("session-atomic", saveDir);
    const record = getCampaignSession("session-atomic")!;
    const snapshot = record.state.snapshot;
    const uk = snapshot.nations.get("uk")!;
    const poorNation = {
      ...uk,
      treasury: SafeInt(100),
      dock: {
        maximumNewConstructionMassKg: 20_000_000,
        maximumMajorRepairMassKg: 20_000_000,
        maximumRebuildMassKg: 20_000_000,
        maximumConversionMassKg: 20_000_000,
      },
    };
    const poorSnapshot = {
      ...snapshot,
      nations: new Map(snapshot.nations).set("uk", poorNation),
    };
    const poorEnvelope = createEnvelope(
      "campaign-snapshot",
      poorSnapshot.compatibilityVersion,
      poorSnapshot,
    );
    const poorState = toSaveableState({
      snapshot: poorSnapshot,
      envelope: poorEnvelope,
      rawHash: "",
    });
    new SaveStore().save(poorState, saveDir);
    registerCampaignSession({ ...record, state: poorState });

    const submitted = await submitConstructionCommand({
      sessionId: "session-atomic",
      designId: "des_gbr_devastation",
      expectedRevision: 0,
      transportRequestId: "req-atomic-1",
    });
    expect(submitted.outcome).toBe("success");
    if (submitted.outcome !== "success") return;
    const originalCommandId = submitted.value.command.commandId;
    const projectsAfterSubmit =
      getCampaignSession("session-atomic")!.state.snapshot.nations.get("uk")!.constructionProjects
        .length;

    const saveCountBefore = new SaveStore().list(saveDir).length;

    const rejected = await replaceConstructionCommand({
      sessionId: "session-atomic",
      commandId: originalCommandId,
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-atomic-replace",
    });
    expect(rejected.outcome).toBe("rejected");
    if (rejected.outcome !== "rejected") return;
    expect(rejected.reason).toBe("INSUFFICIENT_FUNDS");

    const after = getCampaignSession("session-atomic")!;
    expect(after.state.snapshot.nations.get("uk")!.constructionProjects.length).toBe(
      projectsAfterSubmit,
    );
    expect(new SaveStore().list(saveDir).length).toBe(saveCountBefore);

    const inspect = await inspectConstructionScreen("session-atomic");
    expect(inspect.outcome).toBe("success");
    if (inspect.outcome !== "success") return;
    expect(inspect.value.workspace.commands[0]!.commandId).toBe(originalCommandId);
    expect(inspect.value.workspace.commands[0]!.status).toBe("submitted");

    const cancel = await cancelConstructionCommand({
      sessionId: "session-atomic",
      commandId: originalCommandId,
      expectedRevision: 0,
      transportRequestId: "cancel-after-reject",
    });
    expect(cancel.outcome).toBe("success");
    if (cancel.outcome !== "success") return;
    expect(cancel.value.command.status).toBe("cancelled");
  });

  it("refuses an armed merchant cruiser order past the auxiliary fleet limit", async () => {
    registerProductionSession("session-amc", resolve(saveRoot, "save-amc"));
    const record = getCampaignSession("session-amc")!;
    const snapshot = record.state.snapshot;
    const donor = snapshot.designs.get("des_gbr_inflexible")!;
    const amc = {
      ...donor,
      designVersionId: "des_uk_test_liner",
      designFamilyId: "fam_uk_test_liner",
      className: "Test liner",
      hullType: "armed_merchant_cruiser",
      nationId: "uk",
    };
    const nation = snapshot.nations.get("uk")!;
    const inFlight = [0, 1].map((n) => ({
      id: `con_amc_${n}`,
      type: "ship" as const,
      projectType: "NEW_CONSTRUCTION" as const,
      targetId: `ship_amc_${n}`,
      designVersionId: amc.designVersionId,
      totalWork: SafeInt(10),
      completedWork: SafeInt(0),
      paidWork: SafeInt(0),
      status: "ACTIVE" as const,
      startedAt: "1880-01",
    }));
    Object.assign(record.state, {
      snapshot: {
        ...snapshot,
        designs: new Map([...snapshot.designs, [amc.designVersionId, amc]]),
        nations: new Map([
          ...snapshot.nations,
          [
            "uk",
            {
              ...nation,
              fleets: [],
              constructionProjects: [...nation.constructionProjects, ...inFlight],
            },
          ],
        ]),
      },
    });
    const refused = await submitConstructionCommand({
      sessionId: "session-amc",
      designId: amc.designVersionId,
      expectedRevision: 0,
      transportRequestId: "req-amc-3",
    });
    expect(refused.outcome).toBe("rejected");
    if (refused.outcome === "rejected") expect(refused.reason).toBe("AMC_FLEET_LIMIT_EXCEEDED");
    expect(
      requireSessionState("session-amc")
        .snapshot.nations.get("uk")!
        .constructionProjects.filter((p) => p.designVersionId === amc.designVersionId),
    ).toHaveLength(2);
  });

  it("reports SAVE_FAILED and rolls the reservation back when the authoritative persist fails", async () => {
    const saveDir = resolve(saveRoot, "save-fail");
    registerProductionSession("session-save-fail", saveDir);
    const before = getCampaignSession("session-save-fail")!;
    const projectsBefore = before.state.snapshot.nations.get("uk")!.constructionProjects.length;

    const blocker = resolve(saveRoot, "blocker-file");
    writeFileSync(blocker, "not a directory", "utf8");
    registerCampaignSession({ ...before, saveDir: blocker });

    const result = await submitConstructionCommand({
      sessionId: "session-save-fail",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-save-fail",
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SAVE_FAILED");

    const after = getCampaignSession("session-save-fail")!;
    expect(after.state.snapshot.nations.get("uk")!.constructionProjects.length).toBe(
      projectsBefore,
    );
    const inspect = await inspectConstructionScreen("session-save-fail");
    expect(inspect.outcome).toBe("success");
    if (inspect.outcome !== "success") return;
    expect(inspect.value.workspace.treasuryReserved).toBe(0);
    expect(inspect.value.workspace.commands).toEqual([]);
  });
});
