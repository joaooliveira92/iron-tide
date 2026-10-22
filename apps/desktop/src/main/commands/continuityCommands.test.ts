import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore, type SaveMetadata } from "@bluewave/persistence";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
  type CampaignConfiguration,
} from "@bluewave/campaign-engine";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  CompileCampaignResult,
  InspectCampaignResult,
} from "../../shared/campaign-command-contract.js";
import type {
  LoadCampaignResponse,
  RecentCampaignEntry,
  RecoverCampaignResponse,
  ReplayCampaignResponse,
  VerifyCampaignResponse,
} from "../../shared/continuity-contract.js";
import { setResearchPriorityCommandProgram } from "./researchCommands.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { clearCampaignSessionsForTest, getCampaignSession } from "../campaignSessions.js";
import { clearConstructionWorkspacesForTest } from "../constructionWorkspace.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import { compileCampaignProgram } from "./compileCampaign.js";
import { submitConstructionCommandProgram } from "./constructionCommands.js";
import {
  listCampaignsProgram,
  loadCampaignProgram,
  listRecentCampaignsProgram,
  loadRecentCampaignProgram,
  removeRecentCampaignProgram,
  recoverCampaignProgram,
  replayCampaignProgram,
  verifyCampaignProgram,
} from "./continuityCommands.js";
import { inspectCampaignProgram } from "./inspectCampaign.js";
import { submitDesignCommandProgram } from "./designCommands.js";
import { clearPendingWorkspacesForTest, PENDING_COMMANDS_FILENAME } from "../pendingCommands.js";
import { readReferenceDesigns } from "../referenceDesigns.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { programFor, type AnyCommandHandler } from "../runtime/registeredProgram.js";
import { AppPaths, IdGenerator, NativeDialog } from "../runtime/platform.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

let chooseSaveDirectoryAnswer: string | null = null;
let choosePackageDirectoryAnswer: string | null = null;
const userDataRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-userdata-"));

let idCounter = 0;
const nextTestId = () => `test-session-${String(idCounter++)}`;

const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    desktopMainLayer(),
    Layer.succeed(NativeDialog, {
      chooseSaveDirectory: () => Effect.succeed(chooseSaveDirectoryAnswer),
      choosePackageDirectory: () => Effect.succeed(choosePackageDirectoryAnswer),
      chooseCopyDirectory: () => Effect.succeed(null),
    }),
    Layer.succeed(IdGenerator, { next: () => Effect.sync(nextTestId) }),
    Layer.succeed(AppPaths, {
      supportDir: () => Effect.succeed(resolve(userDataRoot, "support")),
      userDataDir: () => Effect.succeed(userDataRoot),
      homeDir: userDataRoot,
      appVersion: () => Effect.succeed("test"),
      platform: "darwin",
      arch: "arm64",
      processId: 1,
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

const compileCampaign = (configuration: CampaignConfiguration) =>
  runProgram<CompileCampaignResult>(compileCampaignProgram, configuration);
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);
const loadCampaign = () => runProgram<LoadCampaignResponse>(loadCampaignProgram, undefined);
const loadRecentCampaign = (packagePath: string) =>
  runProgram<LoadCampaignResponse>(loadRecentCampaignProgram, { packagePath });
const listRecentCampaigns = () =>
  runProgram<readonly RecentCampaignEntry[]>(listRecentCampaignsProgram, undefined);
const removeRecentCampaign = (packagePath: string) =>
  runProgram<readonly RecentCampaignEntry[]>(removeRecentCampaignProgram, { packagePath });
const listCampaigns = () => runProgram<SaveMetadata[]>(listCampaignsProgram, undefined);
const verifyCampaign = () => runProgram<VerifyCampaignResponse>(verifyCampaignProgram, undefined);
const replayCampaign = () => runProgram<ReplayCampaignResponse>(replayCampaignProgram, undefined);
const recoverCampaign = () =>
  runProgram<RecoverCampaignResponse>(recoverCampaignProgram, undefined);
const inspectCampaign = (sessionId: string) =>
  runProgram<InspectCampaignResult>(inspectCampaignProgram, sessionId);
const submitDesignCommand = (payload: unknown) =>
  runProgram<unknown>(submitDesignCommandProgram, payload);
const setResearchPriorityCommand = (payload: unknown) =>
  runProgram<unknown>(setResearchPriorityCommandProgram, payload);
const submitConstructionCommand = (payload: unknown) =>
  runProgram<unknown>(submitConstructionCommandProgram, payload);

function baseConfiguration(overrides: Partial<CampaignConfiguration> = {}): CampaignConfiguration {
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

describe("campaign continuance commands (save, load, verify, replay, recover)", () => {
  let saveRoot: string;
  let nextSessionOrdinal: number;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-continuity-"));
    nextSessionOrdinal = 0;
    idCounter = 0;
    chooseSaveDirectoryAnswer = null;
    choosePackageDirectoryAnswer = null;
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    clearConstructionWorkspacesForTest();
  });

  function randomTransportRequestId(): string {
    return `req-${nextSessionOrdinal++}-${Math.random().toString(36).slice(2)}`;
  }

  function packageAt(saveDir: string | null): void {
    choosePackageDirectoryAnswer = saveDir;
  }

  async function compileAndSave(saveDir: string): Promise<string> {
    chooseSaveDirectoryAnswer = saveDir;
    const result = await compileCampaign(baseConfiguration());
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") throw new Error("fixture compile failed");
    return result.value.sessionId;
  }

  async function advanceOneMonth(sessionId: string, expectedRevision: number): Promise<void> {
    const result = await commitMonth({
      sessionId,
      expectedRevision,
      transportRequestId: randomTransportRequestId(),
    });
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") throw new Error("fixture commitMonth failed");
  }

  function restartApp(): void {
    clearCampaignSessionsForTest();
    clearConstructionWorkspacesForTest();
    clearPendingWorkspacesForTest();
  }

  function torpedoCruiserDraft(): Record<string, unknown> {
    const ref = readReferenceDesigns().find((d) => d.id === "torpedo_cruiser_1880")!;
    return { ...ref.draft, nationId: "uk" };
  }

  function corruptActiveSave(saveDir: string): void {
    const pointer = JSON.parse(readFileSync(join(saveDir, "pointer.json"), "utf8")) as {
      activeSaveId: string;
    };
    const campaignPath = join(saveDir, pointer.activeSaveId, "campaign.json");
    const parsed = JSON.parse(readFileSync(campaignPath, "utf8")) as {
      snapshot?: { campaignId?: string; nations?: Record<string, { treasury?: number }> };
    };
    if (typeof parsed.snapshot?.campaignId !== "string") {
      throw new Error("fixture: expected a campaignId string in the storable snapshot");
    }
    parsed.snapshot.campaignId = `${parsed.snapshot.campaignId}-tampered`;
    writeFileSync(campaignPath, JSON.stringify(parsed));
  }

  function corruptNationTreasury(saveDir: string): void {
    const pointer = JSON.parse(readFileSync(join(saveDir, "pointer.json"), "utf8")) as {
      activeSaveId: string;
    };
    const campaignPath = join(saveDir, pointer.activeSaveId, "campaign.json");
    const parsed = JSON.parse(readFileSync(campaignPath, "utf8")) as {
      snapshot?: { nations?: Record<string, { treasury?: number }> };
    };
    const uk = parsed.snapshot?.nations?.["uk"];
    if (uk === undefined || typeof uk.treasury !== "number") {
      throw new Error("fixture: expected a numeric uk treasury in the storable snapshot");
    }
    uk.treasury = uk.treasury + 1;
    writeFileSync(campaignPath, JSON.stringify(parsed));
  }

  it("closing and reopening the app, then loading the saved package, restores real state (not a fresh/empty campaign)", async () => {
    const saveDir = resolve(saveRoot, "save-a");
    const compileSessionId = await compileAndSave(saveDir);

    const compiled = getCampaignSession(compileSessionId)!;
    const initialTreasury = Number(compiled.state.snapshot.nations.get("uk")!.treasury);

    await advanceOneMonth(compileSessionId, 0);

    restartApp();

    packageAt(saveDir);
    const load = await loadCampaign();
    expect(load.outcome).toBe("success");
    if (load.outcome !== "success") return;
    expect(load.value.packagePath).toBe(saveDir);
    expect(load.value.activeRevision).toBe(1);
    expect(load.value.campaignIdentity.length).toBeGreaterThan(0);

    const open = await inspectCampaign(load.value.sessionId);
    expect(open.outcome).toBe("success");
    if (open.outcome !== "success") return;
    const projection = open.value.projection;
    expect(projection.month).toEqual({ month: 2, year: 1880 });
    expect(projection.revision).toBe(1);
    expect(projection.economy.treasury).not.toBe(initialTreasury);
    expect(projection.economy.treasury).toBe(
      Number(getCampaignSession(load.value.sessionId)!.state.snapshot.nations.get("uk")!.treasury),
    );
    expect(projection.fleet.length).toBeGreaterThan(0);

    await advanceOneMonth(load.value.sessionId, 1);
    const after = getCampaignSession(load.value.sessionId)!;
    expect(Number(after.state.snapshot.turnNumber)).toBe(2);
    expect(after.month).toEqual({ month: 3, year: 1880 });
  });

  it("takes the loaded session id from the injected IdGenerator (deterministic in tests)", async () => {
    const saveDir = resolve(saveRoot, "save-id");
    await compileAndSave(saveDir);
    restartApp();
    packageAt(saveDir);
    const load = await loadCampaign();
    expect(load.outcome).toBe("success");
    if (load.outcome !== "success") return;
    expect(load.value.sessionId).toBe("test-session-1");
  });

  it("surfaces a human-readable incompatible-version message through the load bridge result (ADR-0113)", async () => {
    const saveDir = resolve(saveRoot, "save-incompat");
    await compileAndSave(saveDir);

    const pointer = JSON.parse(readFileSync(join(saveDir, "pointer.json"), "utf8")) as {
      activeSaveId: string;
    };
    const campaignPath = join(saveDir, pointer.activeSaveId, "campaign.json");
    const parsed = JSON.parse(readFileSync(campaignPath, "utf8")) as {
      snapshot: { compatibilityVersion: string };
    };
    parsed.snapshot.compatibilityVersion = "1.0.0";
    writeFileSync(campaignPath, JSON.stringify(parsed), "utf8");

    restartApp();

    packageAt(saveDir);
    const result = await loadCampaign();
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("LOAD_FAILED");
    expect(result.diagnostics.some((m) => m.includes('Save compatibility version "1.0.0"'))).toBe(
      true,
    );
    expect(
      result.diagnostics.some((m) => m.includes("does not match current engine version")),
    ).toBe(true);
  });

  it("verify reports a real pass on a good package and a real fail on a corrupted one", async () => {
    const saveDir = resolve(saveRoot, "save-b");
    await compileAndSave(saveDir);

    packageAt(saveDir);
    const good = await verifyCampaign();
    expect(good.outcome).toBe("success");
    if (good.outcome !== "success") return;
    expect(good.value.valid).toBe(true);
    expect(good.value.issues).toEqual([]);
    expect(good.value.activeRevision).toBe(0);
    expect(good.value.campaignIdentity.length).toBeGreaterThan(0);

    corruptActiveSave(saveDir);

    packageAt(saveDir);
    const bad = await verifyCampaign();
    expect(bad.outcome).toBe("success");
    if (bad.outcome !== "success") return;
    expect(bad.value.valid).toBe(false);
    expect(bad.value.issues.length).toBeGreaterThan(0);
    expect(bad.value.campaignIdentity.length).toBeGreaterThan(0);
  });

  it("replay reconstructs the executed months and confirms a matching deterministic hash", async () => {
    const saveDir = resolve(saveRoot, "save-c");
    const compileSessionId = await compileAndSave(saveDir);
    await advanceOneMonth(compileSessionId, 0);
    await advanceOneMonth(compileSessionId, 1);

    restartApp();

    packageAt(saveDir);
    const replay = await replayCampaign();
    expect(replay.outcome).toBe("success");
    if (replay.outcome !== "success") return;
    expect(replay.value.matched).toBe(true);
    expect(replay.value.revisions).toHaveLength(2);
    for (const revision of replay.value.revisions) {
      expect(revision.matched).toBe(true);
      expect(revision.expectedHash).toBe(revision.actualHash);
      expect(revision.expectedHash.length).toBeGreaterThan(0);
    }
  });

  it("replay re-executes a month's player commands (a submitted design) and still matches", async () => {
    const saveDir = resolve(saveRoot, "save-cmd");
    const sessionId = await compileAndSave(saveDir);
    const queued = await submitDesignCommand({
      sessionId,
      expectedRevision: 0,
      transportRequestId: randomTransportRequestId(),
      className: "Replay Class",
      draft: torpedoCruiserDraft(),
    });
    expect(queued.outcome).toBe("success");
    await advanceOneMonth(sessionId, 0);
    await advanceOneMonth(sessionId, 1);

    restartApp();

    packageAt(saveDir);
    const replay = await replayCampaign();
    expect(replay.outcome).toBe("success");
    if (replay.outcome !== "success") return;
    expect(replay.value.revisions.map((r) => r.matched)).toEqual([true, true]);
    expect(replay.value.matched).toBe(true);
  });

  it("replay re-executes a month's research priority change and still matches", async () => {
    const saveDir = resolve(saveRoot, "save-research");
    const sessionId = await compileAndSave(saveDir);
    const fieldPriorities: Record<string, number> = {};
    for (const field of CANONICAL_RESEARCH_FIELD_IDS)
      fieldPriorities[field] = RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
    fieldPriorities.GUNNERY = RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH;
    const queued = await setResearchPriorityCommand({
      sessionId,
      expectedRevision: 0,
      transportRequestId: randomTransportRequestId(),
      fieldPriorities,
    });
    expect(queued.outcome).toBe("success");
    await advanceOneMonth(sessionId, 0);

    restartApp();

    packageAt(saveDir);
    const replay = await replayCampaign();
    expect(replay.outcome).toBe("success");
    if (replay.outcome !== "success") return;
    expect(replay.value.revisions.map((r) => r.matched)).toEqual([true]);
  });

  function rewriteMonthInput(
    saveDir: string,
    change: (input: Record<string, unknown>) => void,
    rehash: boolean,
  ): void {
    const newest = new SaveStore().list(saveDir)[0]!;
    const dir = join(saveDir, newest.saveId);
    const input = JSON.parse(readFileSync(join(dir, "month-input.json"), "utf8")) as Record<
      string,
      unknown
    >;
    change(input);
    const text = canonicalSerialize(input);
    writeFileSync(join(dir, "month-input.json"), text, "utf8");
    if (rehash) {
      const meta = JSON.parse(readFileSync(join(dir, "metadata.json"), "utf8")) as Record<
        string,
        unknown
      >;
      writeFileSync(
        join(dir, "metadata.json"),
        JSON.stringify({ ...meta, monthInputHash: sha256Hex(text) }),
        "utf8",
      );
    }
  }

  it("replay says a month played under other ship-building content cannot be reproduced, not that it matched", async () => {
    const saveDir = resolve(saveRoot, "save-content");
    const sessionId = await compileAndSave(saveDir);
    await advanceOneMonth(sessionId, 0);
    rewriteMonthInput(
      saveDir,
      (i) => (i["shipBuildingContentHash"] = "an-older-content-version"),
      true,
    );
    restartApp();
    packageAt(saveDir);
    const replay = await replayCampaign();
    if (replay.outcome !== "success") throw new Error("replay failed");
    expect(replay.value.matched).toBe(false);
    expect(replay.value.revisions[0]).toMatchObject({
      matched: false,
      expectedHash: "content-changed",
    });
    expect(replay.diagnostics.join(" ")).toMatch(/different ship-building content/);
  });

  it("replay fails a month whose stored input was altered after the save", async () => {
    const saveDir = resolve(saveRoot, "save-altered");
    const sessionId = await compileAndSave(saveDir);
    await advanceOneMonth(sessionId, 0);
    rewriteMonthInput(saveDir, (i) => (i["commandOutcomes"] = [{ forged: true }]), false);
    restartApp();
    packageAt(saveDir);
    const replay = await replayCampaign();
    if (replay.outcome !== "success") throw new Error("replay failed");
    expect(replay.value.revisions[0]).toMatchObject({ matched: false, expectedHash: "unreadable" });
    expect(replay.diagnostics.join(" ")).toMatch(/does not match its hash/);
  });

  it("a design queued before the app closed is still queued after reopening, and its study approves it", async () => {
    const saveDir = resolve(saveRoot, "save-queue");
    const sessionId = await compileAndSave(saveDir);
    const queued = await submitDesignCommand({
      sessionId,
      expectedRevision: 0,
      transportRequestId: randomTransportRequestId(),
      className: "Survives Restart",
      draft: torpedoCruiserDraft(),
    });
    if (queued.outcome !== "success") throw new Error("submit failed");

    restartApp();

    packageAt(saveDir);
    const load = await loadCampaign();
    if (load.outcome !== "success") throw new Error("load failed");
    const designVersionId = (queued.value as { designVersionId: string }).designVersionId;
    await advanceOneMonth(load.value.sessionId, 0);
    for (let i = 0; i < 8; i++) {
      const current = getCampaignSession(load.value.sessionId)!;
      if (current.state.snapshot.designs.has(designVersionId)) break;
      await advanceOneMonth(load.value.sessionId, Number(current.state.snapshot.turnNumber));
    }
    const design = getCampaignSession(load.value.sessionId)!.state.snapshot.designs.get(
      designVersionId,
    );
    expect(design?.className).toBe("Survives Restart");
    expect(existsSync(join(saveDir, "pending-commands.json"))).toBe(false);
  });

  it("drops a queue left over from a month that has already run, instead of applying it twice", async () => {
    const saveDir = resolve(saveRoot, "save-stale-queue");
    const sessionId = await compileAndSave(saveDir);
    await advanceOneMonth(sessionId, 0);
    writeFileSync(
      join(saveDir, "pending-commands.json"),
      JSON.stringify({ schema: "pending_commands_v1", turnNumber: 0, entries: [] }),
      "utf8",
    );
    restartApp();
    packageAt(saveDir);
    const load = await loadCampaign();
    if (load.outcome !== "success") throw new Error("load failed");
    expect(existsSync(join(saveDir, "pending-commands.json"))).toBe(false);
  });

  it("replay reports a mismatch (not a confident pass) when the persisted history was tampered with", async () => {
    const saveDir = resolve(saveRoot, "save-d");
    const compileSessionId = await compileAndSave(saveDir);
    await advanceOneMonth(compileSessionId, 0);

    restartApp();

    corruptNationTreasury(saveDir);

    packageAt(saveDir);
    const replay = await replayCampaign();
    expect(replay.outcome).toBe("success");
    if (replay.outcome !== "success") return;
    expect(replay.value.matched).toBe(false);
    expect(replay.value.revisions.some((r) => !r.matched)).toBe(true);
  });

  it("a never-advanced campaign replays trivially with zero revisions", async () => {
    const saveDir = resolve(saveRoot, "save-e");
    await compileAndSave(saveDir);

    restartApp();

    packageAt(saveDir);
    const replay = await replayCampaign();
    expect(replay.outcome).toBe("success");
    if (replay.outcome !== "success") return;
    expect(replay.value.matched).toBe(true);
    expect(replay.value.revisions).toEqual([]);
  });

  it("replay picks the truly-newest save per revision even when same-revision saves share a timestamp (F6)", async () => {
    const saveDir = resolve(saveRoot, "save-f6");
    const compileSessionId = await compileAndSave(saveDir);

    const submit = await submitConstructionCommand({
      sessionId: compileSessionId,
      designId: "des_gbr_inflexible",
      expectedRevision: 0,
      transportRequestId: "req-f6-submit",
    });
    expect(submit.outcome).toBe("success");
    if (submit.outcome !== "success") return;

    const sharedTimestamp = "1970-01-01T00:00:00.000Z";
    const turnZeroSaves = new SaveStore().list(saveDir).filter((m) => m.turnNumber === 0);
    expect(turnZeroSaves.length).toBe(2);
    for (const meta of turnZeroSaves) {
      const metaPath = join(saveDir, meta.saveId, "metadata.json");
      const parsed = JSON.parse(readFileSync(metaPath, "utf8")) as { timestamp: string };
      parsed.timestamp = sharedTimestamp;
      writeFileSync(metaPath, JSON.stringify(parsed, null, 2), "utf8");
    }

    await advanceOneMonth(compileSessionId, 0);

    restartApp();

    packageAt(saveDir);
    const replay = await replayCampaign();
    expect(replay.outcome).toBe("success");
    if (replay.outcome !== "success") return;
    expect(replay.value.matched).toBe(true);
    expect(replay.value.revisions).toHaveLength(1);
    expect(replay.value.revisions[0]!.matched).toBe(true);
  });

  it("recover reverts a deliberately corrupted active save to its predecessor and reports the real outcome", async () => {
    const saveDir = resolve(saveRoot, "save-f");
    const compileSessionId = await compileAndSave(saveDir);
    await advanceOneMonth(compileSessionId, 0);

    restartApp();

    corruptActiveSave(saveDir);

    packageAt(saveDir);
    const failed = await loadCampaign();
    expect(failed.outcome).toBe("error");
    if (failed.outcome === "error") expect(failed.reason).toBe("LOAD_FAILED");

    packageAt(saveDir);
    const rec = await recoverCampaign();
    expect(rec.outcome).toBe("success");
    if (rec.outcome !== "success") return;
    expect(rec.value.recovered).toBe(true);
    expect(rec.value.activeRevision).toBe(0);
    expect(rec.value.notes.length).toBeGreaterThan(0);

    packageAt(saveDir);
    const loaded = await loadCampaign();
    expect(loaded.outcome).toBe("success");
    if (loaded.outcome !== "success") return;
    expect(loaded.value.activeRevision).toBe(0);

    const open = await inspectCampaign(loaded.value.sessionId);
    expect(open.outcome).toBe("success");
    if (open.outcome !== "success") return;
    expect(open.value.projection.month).toEqual({ month: 1, year: 1880 });
  });

  it("recover leaves a healthy package untouched (no needless revert)", async () => {
    const saveDir = resolve(saveRoot, "save-g");
    await compileAndSave(saveDir);

    packageAt(saveDir);
    const rec = await recoverCampaign();
    expect(rec.outcome).toBe("success");
    if (rec.outcome !== "success") return;
    expect(rec.value.recovered).toBe(false);
    expect(rec.value.activeRevision).toBe(0);
    expect(rec.value.notes.some((n) => n.includes("no recovery"))).toBe(true);

    packageAt(saveDir);
    const load = await loadCampaign();
    expect(load.outcome).toBe("success");
    if (load.outcome !== "success") return;
    expect(load.value.activeRevision).toBe(0);
  });

  it("loadRecentCampaign reopens a dialog-approved package without prompting again", async () => {
    const saveDir = resolve(saveRoot, "save-recent");
    await compileAndSave(saveDir);

    packageAt(saveDir);
    const first = await loadCampaign();
    expect(first.outcome).toBe("success");

    choosePackageDirectoryAnswer = null;
    const again = await loadRecentCampaign(saveDir);
    expect(again.outcome).toBe("success");
    if (again.outcome !== "success") return;
    expect(again.value.packagePath).toBe(realpathSync(saveDir));
  });

  it("loadRecentCampaign rejects a path the user never picked in the dialog", async () => {
    const saveDir = resolve(saveRoot, "save-unapproved");
    await compileAndSave(saveDir);

    const result = await loadRecentCampaign(saveDir);
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("PACKAGE_NOT_APPROVED");
  });

  it("lists recents newest first and flags a package that disappeared", async () => {
    const dirA = resolve(saveRoot, "save-list-a");
    const dirB = resolve(saveRoot, "save-list-b");
    await compileAndSave(dirA);
    await compileAndSave(dirB);
    packageAt(dirA);
    expect((await loadCampaign()).outcome).toBe("success");
    packageAt(dirB);
    expect((await loadCampaign()).outcome).toBe("success");

    const listed = await listRecentCampaigns();
    expect(listed.outcome).toBe("success");
    if (listed.outcome !== "success") return;
    const mine = listed.value.filter((e) =>
      [dirA, dirB].some((d) => e.packagePath.endsWith(d.split("/").pop()!)),
    );
    expect(mine).toHaveLength(2);
    expect(mine.every((e) => e.available)).toBe(true);

    const moved = `${dirB}-moved`;
    renameSync(dirB, moved);
    const after = await listRecentCampaigns();
    if (after.outcome !== "success") throw new Error("list failed");
    const missing = after.value.find((e) => e.packagePath.endsWith("save-list-b"));
    expect(missing?.available).toBe(false);

    const result = await loadRecentCampaign(missing!.packagePath);
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.reason).toBe("PACKAGE_MISSING");
  });

  it("removeRecentCampaign forgets an entry, which can no longer be reopened", async () => {
    const saveDir = resolve(saveRoot, "save-remove");
    await compileAndSave(saveDir);
    packageAt(saveDir);
    expect((await loadCampaign()).outcome).toBe("success");

    const removed = await removeRecentCampaign(saveDir);
    expect(removed.outcome).toBe("success");
    if (removed.outcome !== "success") return;
    expect(removed.value.some((e) => e.packagePath.endsWith("save-remove"))).toBe(false);

    const result = await loadRecentCampaign(saveDir);
    expect(result.outcome).toBe("error");
    if (result.outcome === "error") expect(result.reason).toBe("PACKAGE_NOT_APPROVED");
  });

  it("matches approved packages by canonical path, so a symlink reaches the same entry", async () => {
    const saveDir = resolve(saveRoot, "save-canonical");
    await compileAndSave(saveDir);
    packageAt(saveDir);
    expect((await loadCampaign()).outcome).toBe("success");

    const link = resolve(saveRoot, "link-to-canonical");
    symlinkSync(saveDir, link);
    const viaLink = await loadRecentCampaign(link);
    expect(viaLink.outcome).toBe("success");
    const before = await listRecentCampaigns();
    if (before.outcome !== "success") throw new Error("list failed");
    expect(before.value.filter((e) => e.packagePath.endsWith("save-canonical"))).toHaveLength(1);
  });

  it("rejects an unknown payload shape for loadRecentCampaign", async () => {
    const result = await runProgram<LoadCampaignResponse>(loadRecentCampaignProgram, {
      packagePath: "/tmp/x",
      extra: true,
    });
    expect(result.outcome).toBe("error");
  });

  it("loads a read-only package even when it holds a stale pending-commands file", async () => {
    const saveDir = resolve(saveRoot, "save-readonly");
    await compileAndSave(saveDir);
    writeFileSync(resolve(saveDir, PENDING_COMMANDS_FILENAME), "{ not json", "utf8");
    chmodSync(saveDir, 0o555);
    try {
      packageAt(saveDir);
      const loaded = await loadCampaign();
      expect(loaded.outcome).toBe("success");
    } finally {
      chmodSync(saveDir, 0o755);
    }
  });

  it("every command reports PACKAGE_SELECTION_CANCELLED when the dialog is cancelled", async () => {
    for (const run of [loadCampaign, verifyCampaign, replayCampaign, recoverCampaign]) {
      packageAt(null);
      const result = await run();
      expect(result.outcome).toBe("rejected");
      if (result.outcome === "rejected") expect(result.reason).toBe("PACKAGE_SELECTION_CANCELLED");
    }
  });

  it("rejects a package with no session.json sidecar (cannot restore a real session)", async () => {
    const saveDir = resolve(saveRoot, "save-h");
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");
    new SaveStore().save(toSaveableState(output.state), saveDir);

    packageAt(saveDir);
    const load = await loadCampaign();
    expect(load.outcome).toBe("error");
    if (load.outcome === "error") expect(load.reason).toBe("SESSION_METADATA_MISSING");

    packageAt(saveDir);
    const replay = await replayCampaign();
    expect(replay.outcome).toBe("error");
    if (replay.outcome === "error") expect(replay.reason).toBe("SESSION_METADATA_MISSING");
  });
});

describe("listCampaigns (campaign-list screen backing query)", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-listcampaigns-"));
    chooseSaveDirectoryAnswer = null;
    choosePackageDirectoryAnswer = null;
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    clearConstructionWorkspacesForTest();
  });

  it("lists real saves with the additive campaign-list fields", async () => {
    const saveDir = resolve(saveRoot, "save-a");
    chooseSaveDirectoryAnswer = saveDir;
    const result = await compileCampaign(baseConfiguration());
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") throw new Error("fixture compile failed");

    choosePackageDirectoryAnswer = saveDir;
    const list = await listCampaigns();
    expect(list.outcome).toBe("success");
    if (list.outcome !== "success") return;
    expect(list.value.length).toBeGreaterThanOrEqual(1);
    const record = list.value[0];
    expect(record).toBeDefined();
    if (record === undefined) return;
    expect(record.campaignName).toBeTypeOf("string");
    expect(record.nationId).toBeTypeOf("string");
    expect(record.campaignDate).toEqual(
      expect.objectContaining({ year: expect.any(Number), month: expect.any(Number) }),
    );
    expect(record.compatibilityVersion).toBeTypeOf("string");
  });

  it("returns an empty list for a directory with no valid saves (corrupt/incompatible skipped)", async () => {
    const saveDir = resolve(saveRoot, "empty");
    mkdirSync(saveDir, { recursive: true });

    choosePackageDirectoryAnswer = saveDir;
    const list = await listCampaigns();
    expect(list.outcome).toBe("success");
    if (list.outcome !== "success") return;
    expect(list.value).toEqual([]);
  });

  it("returns a cancelled rejection when the user cancels the directory dialog", async () => {
    choosePackageDirectoryAnswer = null;
    const list = await listCampaigns();
    expect(list.outcome).toBe("rejected");
    if (list.outcome !== "rejected") return;
    expect(list.reason).toBe("PACKAGE_SELECTION_CANCELLED");
  });
});
