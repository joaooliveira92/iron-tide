import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { describe, expect, it, beforeEach, afterEach } from "vite-plus/test";
import { CAMPAIGN_COMMAND_NAMES } from "../shared/campaign-command-contract.js";
import type {
  ConstructionBatchPreviewOutcome,
  ForeignConstructionPreviewOutcome,
} from "../shared/construction-contract.js";
import { dispatchCampaignCommand } from "./campaignBridge.js";
import { clearCampaignSessionsForTest, registerCampaignSession } from "./campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "./compiler.js";
import { toSaveableState } from "./saveHelpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

const IMPLEMENTED_COMMANDS = new Set([
  // Tactical Sandbox (ADR-0057): routed, but debug-gated inside the handler.
  "generateBattle",
  "resolveBattle",
  "resolveTacticalBattle",
  "replayBattleBoundary",
  "seedCampaignBattleDrill",
  "listNewGameOptions",
  "compileCampaign",
  "inspectCampaign",
  "inspectOpeningBriefing",
  "inspectMap",
  "inspectBattleHistory",
  "inspectPriorities",
  "inspectDrawingBoardContent",
  "inspectPresentationContent",
  "inspectUiCatalogue",
  "readTurnSummaries",
  "resolveTurn",
  "answerDecision",
  "submitBattleResult",
  "submitOfferResponse",
  "abandonPendingTurn",
  "readPendingTurn",
  "commitMonth",
  "inspectConstructionScreen",
  "submitConstructionCommand",
  "replaceConstructionCommand",
  "cancelConstructionCommand",
  "haltConstructionCommand",
  "resumeConstructionCommand",
  "setAccelerationCommand",
  "cancelConstructionProjectCommand",
  "orderConstructionBatchCommand",
  "previewConstructionBatchCommand",
  "authorizeDockExpansionCommand",
  "placeForeignConstructionCommand",
  "previewForeignConstructionCommand",
  "inspectFleetScreen",
  "inspectResearchScreen",
  "setResearchPriorityCommand",
  "inspectDiplomacyScreen",
  "inspectDivisionScreen",
  "copyCampaign",
  "saveCampaign",
  "closeCampaign",
  "submitDivisionCommand",
  "submitStationAssignment",
  "inspectBudgetScreen",
  "submitMovementCommand",
  "replaceMovementCommand",
  "cancelMovementCommand",
  "submitBudgetAllocation",
  "submitDesignCommand",
  "reviseProjectCommand",
  "loadProjectDraft",
  "readDrawingBoardDraft",
  "writeDrawingBoardDraft",
  "listRebuildableShips",
  "loadShipDraft",
  "checkRebuild",
  "startRebuildCommand",
  "submitDiplomacyCommand",
  "readUiState",
  "writeUiState",
  "readMonthlyReports",
  "loadCampaign",
  "loadRecentCampaign",
  "listRecentCampaigns",
  "removeRecentCampaign",
  "listCampaigns",
  "verifyCampaign",
  "replayCampaign",
  "recoverCampaign",
]);

describe("dispatchCampaignCommand", () => {
  it("rejects an unknown command name", async () => {
    const result = await dispatchCampaignCommand("notARealCommand", undefined);
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("UNKNOWN_COMMAND");
  });

  it("still returns NOT_IMPLEMENTED for every command outside the implemented set", async () => {
    const outOfScope = CAMPAIGN_COMMAND_NAMES.filter((name) => !IMPLEMENTED_COMMANDS.has(name));
    for (const command of outOfScope) {
      const result = await dispatchCampaignCommand(command, undefined);
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") continue;
      expect(result.reason).toBe("NOT_IMPLEMENTED");
    }
  });

  it("rejects malformed Tactical Sandbox payloads before touching the engine", async () => {
    for (const [command, payload] of [
      ["generateBattle", { warId: "w" }],
      ["generateBattle", { sessionId: "s", warId: "w", strengthScale: 0 }],
      ["resolveBattle", { sessionId: "s" }],
      [
        "resolveTacticalBattle",
        { sessionId: "s", battleId: "b", turnCount: 0, scriptedOrders: [] },
      ],
      ["replayBattleBoundary", {}],
      ["seedCampaignBattleDrill", { sessionId: "s", warId: 7 }],
    ] as const) {
      const result = await dispatchCampaignCommand(command, payload);
      expect(result).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
    }
  });

  it("answers valid Tactical Sandbox commands with DEBUG_ONLY outside a debug build (R4)", async () => {
    for (const [command, payload] of [
      ["generateBattle", { sessionId: "s", warId: "w" }],
      // `warId` is optional: the Simulation Battle Arena omits it and lets the
      // command auto-select the player's active war.
      ["generateBattle", { sessionId: "s" }],
      ["resolveBattle", { sessionId: "s", battleId: "b" }],
      [
        "resolveTacticalBattle",
        { sessionId: "s", battleId: "b", turnCount: 1, scriptedOrders: [] },
      ],
      ["replayBattleBoundary", { sessionId: "s", battleId: "b" }],
      ["seedCampaignBattleDrill", { sessionId: "s", warId: "w" }],
    ] as const) {
      const result = await dispatchCampaignCommand(command, payload);
      expect(result).toMatchObject({ outcome: "rejected", reason: "DEBUG_ONLY" });
    }
  });

  it("routes listNewGameOptions to the real handler against production content", async () => {
    const result = await dispatchCampaignCommand("listNewGameOptions", undefined);
    expect(result.outcome).toBe("success");
  });

  it("serves the decoded drawing-board catalogue over the content IPC", async () => {
    const result = await dispatchCampaignCommand("inspectDrawingBoardContent", undefined);
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    const { catalogue } = result.value as {
      catalogue: {
        components: readonly unknown[];
        hullForms: readonly unknown[];
        referenceDesigns?: readonly unknown[];
      };
    };
    expect(catalogue.components.length).toBeGreaterThan(0);
    expect(catalogue.hullForms.length).toBeGreaterThan(0);
    expect(catalogue.referenceDesigns?.length ?? 0).toBeGreaterThan(0);
  });

  it("rejects a structurally invalid compileCampaign payload before touching the compiler", async () => {
    const result = await dispatchCampaignCommand("compileCampaign", { garbage: true });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
  });

  it("rejects a non-string inspectCampaign payload", async () => {
    const result = await dispatchCampaignCommand("inspectCampaign", { sessionId: 123 });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
  });

  it("returns SESSION_NOT_FOUND for a well-formed but unknown inspectCampaign session id", async () => {
    const result = await dispatchCampaignCommand("inspectCampaign", "no-such-session");
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects a non-string inspectBattleHistory payload", async () => {
    const result = await dispatchCampaignCommand("inspectBattleHistory", { sessionId: 123 });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
  });

  it("returns SESSION_NOT_FOUND for an unknown inspectBattleHistory session id", async () => {
    const result = await dispatchCampaignCommand("inspectBattleHistory", "no-such-session");
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects a non-string inspectMap payload", async () => {
    const result = await dispatchCampaignCommand("inspectMap", { sessionId: 123 });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
  });

  it("returns SESSION_NOT_FOUND for a well-formed but unknown inspectMap session id", async () => {
    const result = await dispatchCampaignCommand("inspectMap", "no-such-session");
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects a structurally invalid commitMonth payload", async () => {
    const result = await dispatchCampaignCommand("commitMonth", { sessionId: "s" });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
  });

  it("returns SESSION_NOT_FOUND for a well-formed but unknown commitMonth session id", async () => {
    const result = await dispatchCampaignCommand("commitMonth", {
      sessionId: "no-such-session",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects structurally invalid construction payloads before touching the handlers", async () => {
    for (const command of [
      "submitConstructionCommand",
      "replaceConstructionCommand",
      "cancelConstructionCommand",
    ] as const) {
      const result = await dispatchCampaignCommand(command, { sessionId: "s" });
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") return;
      expect(result.reason).toBe("INVALID_PAYLOAD");
    }
  });

  it("returns SESSION_NOT_FOUND for well-formed construction payloads against an unknown session", async () => {
    const submit = await dispatchCampaignCommand("submitConstructionCommand", {
      sessionId: "no-such-session",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(submit.outcome).toBe("error");
    if (submit.outcome !== "error") return;
    expect(submit.reason).toBe("SESSION_NOT_FOUND");

    const replace = await dispatchCampaignCommand("replaceConstructionCommand", {
      sessionId: "no-such-session",
      commandId: "cmd-x",
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(replace.outcome).toBe("error");
    if (replace.outcome !== "error") return;
    expect(replace.reason).toBe("SESSION_NOT_FOUND");

    const cancel = await dispatchCampaignCommand("cancelConstructionCommand", {
      sessionId: "no-such-session",
      commandId: "cmd-x",
      expectedRevision: 0,
      transportRequestId: "req-1",
    });
    expect(cancel.outcome).toBe("error");
    if (cancel.outcome !== "error") return;
    expect(cancel.reason).toBe("SESSION_NOT_FOUND");
  });

  it("returns SESSION_NOT_FOUND for inspectConstructionScreen without a session", async () => {
    const result = await dispatchCampaignCommand("inspectConstructionScreen", "no-such-session");
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects structurally invalid construction steering payloads before touching the handlers", async () => {
    for (const [command, payload] of [
      ["haltConstructionCommand", { sessionId: "s", expectedRevision: 0, transportRequestId: "r" }],
      [
        "resumeConstructionCommand",
        { sessionId: "s", expectedRevision: 0, transportRequestId: "r" },
      ],
      [
        "setAccelerationCommand",
        {
          sessionId: "s",
          expectedRevision: 0,
          transportRequestId: "r",
          projectId: "p",
          accelerated: "yes",
        },
      ],
      [
        "orderConstructionBatchCommand",
        {
          sessionId: "s",
          expectedRevision: 0,
          transportRequestId: "r",
          designVersionId: "d",
          quantity: 0,
        },
      ],
      [
        "authorizeDockExpansionCommand",
        { sessionId: "s", expectedRevision: 0, transportRequestId: "r" },
      ],
      [
        "cancelConstructionProjectCommand",
        { sessionId: "s", expectedRevision: 0, transportRequestId: "r" },
      ],
    ] as const) {
      const result = await dispatchCampaignCommand(command, payload);
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") return;
      expect(result.reason).toBe("INVALID_PAYLOAD");
    }
  });

  it("returns SESSION_NOT_FOUND for well-formed construction steering payloads against an unknown session", async () => {
    for (const [command, payload] of [
      [
        "haltConstructionCommand",
        {
          sessionId: "no-such-session",
          expectedRevision: 0,
          transportRequestId: "r",
          projectId: "p",
        },
      ],
      [
        "resumeConstructionCommand",
        {
          sessionId: "no-such-session",
          expectedRevision: 0,
          transportRequestId: "r",
          projectId: "p",
        },
      ],
      [
        "setAccelerationCommand",
        {
          sessionId: "no-such-session",
          expectedRevision: 0,
          transportRequestId: "r",
          projectId: "p",
          accelerated: true,
        },
      ],
      [
        "orderConstructionBatchCommand",
        {
          sessionId: "no-such-session",
          expectedRevision: 0,
          transportRequestId: "r",
          designVersionId: "d",
          quantity: 3,
        },
      ],
      [
        "authorizeDockExpansionCommand",
        {
          sessionId: "no-such-session",
          expectedRevision: 0,
          transportRequestId: "r",
          possessionId: "pos",
        },
      ],
      [
        "cancelConstructionProjectCommand",
        {
          sessionId: "no-such-session",
          expectedRevision: 0,
          transportRequestId: "r",
          projectId: "p",
        },
      ],
    ] as const) {
      const result = await dispatchCampaignCommand(command, payload);
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") return;
      expect(result.reason).toBe("SESSION_NOT_FOUND");
    }
  });

  it("rejects a structurally invalid setResearchPriorityCommand payload before touching the handler", async () => {
    for (const payload of [
      { sessionId: "s" },
      {
        sessionId: "s",
        expectedRevision: 0,
        transportRequestId: "r",
        fieldPriorities: { GUNNERY: 1.5 },
      },
      { sessionId: "s", expectedRevision: 0, transportRequestId: "r", fieldPriorities: "high" },
    ]) {
      const result = await dispatchCampaignCommand("setResearchPriorityCommand", payload);
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") return;
      expect(result.reason).toBe("INVALID_PAYLOAD");
    }
  });

  it("returns SESSION_NOT_FOUND for a well-formed setResearchPriorityCommand against an unknown session", async () => {
    const result = await dispatchCampaignCommand("setResearchPriorityCommand", {
      sessionId: "no-such-session",
      expectedRevision: 0,
      transportRequestId: "req-1",
      fieldPriorities: { GUNNERY: 4 },
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects a structurally invalid submitDiplomacyCommand payload before touching the handler", async () => {
    for (const payload of [
      { sessionId: "s" },
      {
        sessionId: "s",
        expectedRevision: 0,
        transportRequestId: "r",
        command: { type: "DeclareWar" }, // missing targetNationId
      },
      {
        sessionId: "s",
        expectedRevision: 0,
        transportRequestId: "r",
        command: { type: "NotACommand", targetNationId: "fra" },
      },
      {
        sessionId: "s",
        expectedRevision: 0,
        transportRequestId: "r",
        command: { type: "DeclareBlockade", targetNationId: "fra" }, // missing areaId
      },
    ]) {
      const result = await dispatchCampaignCommand("submitDiplomacyCommand", payload);
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") return;
      expect(result.reason).toBe("INVALID_PAYLOAD");
    }
  });

  it("returns SESSION_NOT_FOUND for a well-formed submitDiplomacyCommand against an unknown session", async () => {
    const result = await dispatchCampaignCommand("submitDiplomacyCommand", {
      sessionId: "no-such-session",
      expectedRevision: 0,
      transportRequestId: "req-1",
      command: { type: "DeclareWar", targetNationId: "france" },
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("returns SESSION_NOT_FOUND for inspectDiplomacyScreen without a session", async () => {
    const result = await dispatchCampaignCommand("inspectDiplomacyScreen", "no-such-session");
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("returns SESSION_NOT_FOUND for inspectResearchScreen without a session", async () => {
    const result = await dispatchCampaignCommand("inspectResearchScreen", "no-such-session");
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects a non-string inspectOpeningBriefing payload", async () => {
    const result = await dispatchCampaignCommand("inspectOpeningBriefing", {
      sessionId: 123,
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
  });

  it("returns SESSION_NOT_FOUND for inspectOpeningBriefing without a session", async () => {
    const result = await dispatchCampaignCommand("inspectOpeningBriefing", "no-such-session");
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects a non-string readUiState payload", async () => {
    const result = await dispatchCampaignCommand("readUiState", { sessionId: 123 });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
  });

  it("returns SESSION_NOT_FOUND for readUiState without a session", async () => {
    const result = await dispatchCampaignCommand("readUiState", "no-such-session");
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects a non-string readMonthlyReports payload", async () => {
    const result = await dispatchCampaignCommand("readMonthlyReports", { sessionId: 123 });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("INVALID_PAYLOAD");
  });

  it("returns SESSION_NOT_FOUND for readMonthlyReports without a session", async () => {
    const result = await dispatchCampaignCommand("readMonthlyReports", "no-such-session");
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  it("rejects structurally invalid writeUiState payloads before touching the handler", async () => {
    const longFingerprint = "f".repeat(257);
    const oversizedArray = Array.from({ length: 65 }, (_, i) => `fp-${i}`);
    for (const payload of [
      { sessionId: "s" }, // missing dismissedFingerprints
      { sessionId: "s", dismissedFingerprints: "high" }, // not an array
      { sessionId: "s", dismissedFingerprints: [123] }, // non-string fingerprint
      { sessionId: "s", dismissedFingerprints: [longFingerprint] }, // fingerprint > 256 chars
      { sessionId: "s", dismissedFingerprints: oversizedArray }, // array > 64 entries
      {
        sessionId: "s",
        dismissedFingerprints: [],
        firstMonthInspection: { status: "in_progress" }, // missing lastCompletedStep
      },
      {
        sessionId: "s",
        dismissedFingerprints: [],
        firstMonthInspection: { status: "paused", lastCompletedStep: 0 }, // unknown status
      },
      {
        sessionId: "s",
        dismissedFingerprints: [],
        firstMonthInspection: { status: "completed", lastCompletedStep: 7 }, // > 6 steps
      },
      {
        sessionId: "s",
        dismissedFingerprints: [],
        firstMonthInspection: { status: "completed", lastCompletedStep: -1 }, // negative
      },
    ]) {
      const result = await dispatchCampaignCommand("writeUiState", payload);
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") return;
      expect(result.reason).toBe("INVALID_PAYLOAD");
    }
  });

  it("returns SESSION_NOT_FOUND for a well-formed writeUiState against an unknown session", async () => {
    const result = await dispatchCampaignCommand("writeUiState", {
      sessionId: "no-such-session",
      dismissedFingerprints: ["fp-1"],
      firstMonthInspection: { status: "in_progress", lastCompletedStep: 1 },
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  describe("previewConstructionBatchCommand (SB3-R30/R33)", () => {
    let saveRoot: string;
    let sessionId: string;

    beforeEach(() => {
      sessionId = "session-batch-preview";
      saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-bridge-batch-preview-"));
      const saveDir = resolve(saveRoot, "save");
      const signal = new AbortController().signal;
      const collector = new DiagnosticCollector();
      const output = compileProductionCampaignFromArtifact(GENERATED_ARTIFACT, signal, collector);
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
    });

    afterEach(() => {
      rmSync(saveRoot, { recursive: true, force: true });
      clearCampaignSessionsForTest();
    });

    it("previews names and dock fit for a real UK design through the bridge", async () => {
      const result = await dispatchCampaignCommand("previewConstructionBatchCommand", {
        sessionId,
        designVersionId: "des_gbr_inflexible",
        quantity: 3,
      });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      const value = result.value as ConstructionBatchPreviewOutcome;
      expect(value).toMatchObject({
        ok: true,
        preview: {
          designVersionId: "des_gbr_inflexible",
          quantity: 3,
          dockCeilingKg: 13_000_000,
          fitsDock: true,
        },
      });
      if (!value.ok) return;
      expect(value.preview.names).toHaveLength(3);
      for (const allocation of value.preview.names) {
        expect(allocation.name.length).toBeGreaterThan(0);
      }
      expect(value.preview.designDisplacementKg).toBeGreaterThan(0);
    });

    it("returns the engine's CONSTRUCTION_BATCH_LIMIT_EXCEEDED reason for a quantity above 12", async () => {
      const result = await dispatchCampaignCommand("previewConstructionBatchCommand", {
        sessionId,
        designVersionId: "des_gbr_inflexible",
        quantity: 13,
      });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      expect(result.value).toMatchObject({
        ok: false,
        reason: "CONSTRUCTION_BATCH_LIMIT_EXCEEDED",
      });
    });

    it("rejects a non-positive quantity at the wire boundary", async () => {
      const result = await dispatchCampaignCommand("previewConstructionBatchCommand", {
        sessionId,
        designVersionId: "des_gbr_inflexible",
        quantity: 0,
      });
      expect(result).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
    });

    it("returns SESSION_NOT_FOUND for an unknown session", async () => {
      const result = await dispatchCampaignCommand("previewConstructionBatchCommand", {
        sessionId: "no-such-session",
        designVersionId: "des_gbr_inflexible",
        quantity: 1,
      });
      expect(result).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
    });
  });

  describe("previewForeignConstructionCommand (SB3-R20/R34, INC-9b)", () => {
    let saveRoot: string;
    let sessionId: string;

    beforeEach(() => {
      sessionId = "session-foreign-preview";
      saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-bridge-foreign-preview-"));
      const saveDir = resolve(saveRoot, "save");
      const signal = new AbortController().signal;
      const collector = new DiagnosticCollector();
      const output = compileProductionCampaignFromArtifact(GENERATED_ARTIFACT, signal, collector);
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
    });

    afterEach(() => {
      rmSync(saveRoot, { recursive: true, force: true });
      clearCampaignSessionsForTest();
    });

    it("lists candidate builders and derives the contract terms for a chosen one", async () => {
      const listed = await dispatchCampaignCommand("previewForeignConstructionCommand", {
        sessionId,
        designVersionId: "des_gbr_inflexible",
        quantity: 2,
      });
      expect(listed.outcome).toBe("success");
      if (listed.outcome !== "success") return;
      const value = listed.value as ForeignConstructionPreviewOutcome;
      expect(value.ok).toBe(true);
      if (!value.ok) return;
      expect(value.preview.builders.length).toBeGreaterThan(0);
      expect(value.preview.builders.every((b) => b.nationId !== "uk")).toBe(true);
      expect(value.preview.contract).toBeNull();

      const builderNationId = value.preview.builders[0]!.nationId;
      const chosen = await dispatchCampaignCommand("previewForeignConstructionCommand", {
        sessionId,
        designVersionId: "des_gbr_inflexible",
        quantity: 2,
        builderNationId,
      });
      expect(chosen.outcome).toBe("success");
      if (chosen.outcome !== "success") return;
      const chosenValue = chosen.value as ForeignConstructionPreviewOutcome;
      expect(chosenValue.ok).toBe(true);
      if (!chosenValue.ok) return;
      expect(chosenValue.preview.contract).not.toBeNull();
      expect(chosenValue.preview.contract!.totalPriceUnits).toBe(
        chosenValue.preview.contract!.totalWorkPerUnit * 2,
      );
    });

    it("returns the engine's FOREIGN_CONSTRUCTION_QUANTITY_INVALID reason above 12", async () => {
      const result = await dispatchCampaignCommand("previewForeignConstructionCommand", {
        sessionId,
        designVersionId: "des_gbr_inflexible",
        quantity: 13,
      });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      expect(result.value).toMatchObject({
        ok: false,
        reason: "FOREIGN_CONSTRUCTION_QUANTITY_INVALID",
      });
    });

    it("rejects a non-positive quantity at the wire boundary", async () => {
      const result = await dispatchCampaignCommand("previewForeignConstructionCommand", {
        sessionId,
        designVersionId: "des_gbr_inflexible",
        quantity: 0,
      });
      expect(result).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
    });

    it("returns SESSION_NOT_FOUND for an unknown session", async () => {
      const result = await dispatchCampaignCommand("previewForeignConstructionCommand", {
        sessionId: "no-such-session",
        designVersionId: "des_gbr_inflexible",
        quantity: 1,
      });
      expect(result).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
    });
  });

  describe("ui-state dispatch happy paths", () => {
    let saveRoot: string;
    let sessionId: string;
    let saveDir: string;

    beforeEach(() => {
      sessionId = "session-dispatch";
      saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-bridge-ui-state-"));
      saveDir = resolve(saveRoot, "save");
      const signal = new AbortController().signal;
      const collector = new DiagnosticCollector();
      const output = compileProductionCampaignFromArtifact(GENERATED_ARTIFACT, signal, collector);
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
    });

    afterEach(() => {
      rmSync(saveRoot, { recursive: true, force: true });
      clearCampaignSessionsForTest();
    });

    it("writeUiState round-trips through the dispatch boundary", async () => {
      const write = await dispatchCampaignCommand("writeUiState", {
        sessionId,
        dismissedFingerprints: ["fp-1"],
        firstMonthInspection: { status: "in_progress", lastCompletedStep: 2 },
      });
      expect(write.outcome).toBe("success");
      if (write.outcome !== "success") return;

      const read = await dispatchCampaignCommand("readUiState", sessionId);
      expect(read.outcome).toBe("success");
      if (read.outcome !== "success") return;
      expect(read.value).toEqual(write.value);
    });

    it("readMonthlyReports returns an empty history before any commit", async () => {
      const read = await dispatchCampaignCommand("readMonthlyReports", sessionId);
      expect(read.outcome).toBe("success");
      if (read.outcome !== "success") return;
      expect(read.value).toEqual({ reports: [] });
    });
  });
});
