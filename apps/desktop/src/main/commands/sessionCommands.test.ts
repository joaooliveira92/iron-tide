import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_SCENARIO_IDS,
  type CampaignSnapshot,
  type CampaignState,
} from "@bluewave/campaign";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  DivisionCommandOutcome,
  DivisionScreenProjection,
} from "../../shared/division-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { SESSION_METADATA_FILENAME } from "../campaignSessionMetadata.js";
import { clearPendingWorkspacesForTest, pendingEnvelopesForExecution } from "../pendingCommands.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { NativeDialog } from "../runtime/platform.js";
import { ProjectStore } from "../runtime/projectStore.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import { inspectDivisionScreenProgram, submitDivisionCommandProgram } from "./divisionCommands.js";
import {
  clearConstructionWorkspacesForTest,
  getConstructionWorkspace,
  hasConstructionWorkspace,
} from "../constructionWorkspace.js";
import {
  closeCampaignProgram,
  copyCampaignProgram,
  saveCampaignProgram,
} from "./sessionCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_ARTIFACT = resolve(__dirname, "../../../../..", "content", "generated", "1880");

let chooseCopyDirectoryAnswer: string | null = null;
let chooseCopyDirectoryCalls = 0;

const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    desktopMainLayer(),
    Layer.succeed(NativeDialog, {
      chooseSaveDirectory: () => Effect.succeed(null),
      choosePackageDirectory: () => Effect.succeed(null),
      chooseCopyDirectory: () => {
        chooseCopyDirectoryCalls += 1;
        return Effect.succeed(chooseCopyDirectoryAnswer);
      },
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

const saveCampaign = (sessionId: string) =>
  runtime.runPromiseExit(saveCampaignProgram(sessionId)).then((exit) => projectCommandExit(exit));
const closeCampaign = (sessionId: string) =>
  runtime.runPromiseExit(closeCampaignProgram(sessionId)).then((exit) => projectCommandExit(exit));
const copyCampaign = (sessionId: string) =>
  runtime.runPromiseExit(copyCampaignProgram(sessionId)).then((exit) => projectCommandExit(exit));
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);
const inspectDivisionScreen = (sessionId: string) =>
  runProgram<DivisionScreenProjection>(inspectDivisionScreenProgram, sessionId);
const submitDivisionCommand = (payload: unknown) =>
  runProgram<DivisionCommandOutcome>(submitDivisionCommandProgram, payload);

function writeSessionMetadata(saveDir: string, metadata: unknown): void {
  writeFileSync(
    join(saveDir, SESSION_METADATA_FILENAME),
    JSON.stringify(metadata, null, 2),
    "utf8",
  );
}

function readSessionMetadata(saveDir: string): unknown {
  return JSON.parse(readFileSync(join(saveDir, SESSION_METADATA_FILENAME), "utf8"));
}

describe("session commands (save / close / copy)", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(resolve(tmpdir(), "bw-desktop-session-"));
    chooseCopyDirectoryAnswer = null;
    chooseCopyDirectoryCalls = 0;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    clearPendingWorkspacesForTest();
    clearConstructionWorkspacesForTest();
  });

  function register(sessionId: string): { saveDir: string; state: CampaignState } {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    if (!output) throw new Error("production pack failed to compile");
    const snapshot: CampaignSnapshot = structuredClone(output.state.snapshot);
    const state = toSaveableState({
      snapshot,
      envelope: createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot),
      rawHash: "",
    });
    const saveDir = resolve(root, sessionId);
    new SaveStore().save(state, saveDir);
    writeSessionMetadata(saveDir, {
      schemaVersion: "session_meta_v1",
      scenarioId: CANONICAL_SCENARIO_IDS[0]!,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
    });
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });
    return { saveDir, state };
  }

  const savesIn = (dir: string) => new SaveStore().list(dir).length;

  describe("saveCampaign", () => {
    it("fails honestly for an unknown session", async () => {
      expect(await saveCampaign("nope")).toMatchObject({
        outcome: "error",
        reason: "SESSION_NOT_FOUND",
      });
    });

    it("is a no-op when the package already holds the current turn — safe to click repeatedly", async () => {
      const { saveDir } = register("s1");
      expect(savesIn(saveDir)).toBe(1);
      for (let i = 0; i < 3; i++) {
        expect(await saveCampaign("s1")).toMatchObject({
          outcome: "success",
          value: { revision: 0 },
        });
      }
      expect(savesIn(saveDir)).toBe(1);
    });

    it("re-writes the package when it is missing", async () => {
      const { saveDir } = register("s2");
      rmSync(saveDir, { recursive: true, force: true });
      expect(existsSync(saveDir)).toBe(false);
      expect(await saveCampaign("s2")).toMatchObject({
        outcome: "success",
        value: { revision: 0 },
      });
      expect(savesIn(saveDir)).toBe(1);
    });

    it("notices a package that differs from the live state within the SAME turn, and fixes it once", async () => {
      const { saveDir, state } = register("s4");
      const altered = structuredClone(state.snapshot);
      const uk = altered.nations.get("uk")!;
      altered.nations.set("uk", {
        ...uk,
        treasury: (Number(uk.treasury) + 1) as typeof uk.treasury,
      });
      new SaveStore().save(
        toSaveableState({
          snapshot: altered,
          envelope: createEnvelope("campaign-snapshot", altered.compatibilityVersion, altered),
          rawHash: "",
        }),
        saveDir,
      );
      expect(savesIn(saveDir)).toBe(2);

      expect(await saveCampaign("s4")).toMatchObject({
        outcome: "success",
        value: { revision: 0 },
      });
      expect(savesIn(saveDir)).toBe(3);
      await saveCampaign("s4");
      expect(savesIn(saveDir)).toBe(3);
    });

    it("reports the new revision after a month is committed, without duplicating the save", async () => {
      const { saveDir } = register("s3");
      const committed = await commitMonth({
        sessionId: "s3",
        expectedRevision: 0,
        transportRequestId: "c1",
      });
      expect(committed.outcome).toBe("success");
      const before = savesIn(saveDir);
      expect(await saveCampaign("s3")).toMatchObject({
        outcome: "success",
        value: { revision: 1 },
      });
      expect(savesIn(saveDir)).toBe(before);
    });
  });

  describe("closeCampaign", () => {
    it("removes the session and drops its queued, uncommitted commands", async () => {
      register("c1");
      const view = await inspectDivisionScreen("c1");
      if (view.outcome !== "success") throw new Error("inspect failed");
      expect(view.value.divisions.length).toBeGreaterThan(0);
      const queued = await submitDivisionCommand({
        sessionId: "c1",
        expectedRevision: 0,
        transportRequestId: "r1",
        command: {
          type: "DissolveDivision",
          divisionId: view.value.divisions[0]!.divisionId,
        },
      });
      expect(queued.outcome).toBe("success");
      const snapshot = getCampaignSession("c1")!.state.snapshot;
      expect(pendingEnvelopesForExecution("c1", snapshot)).toHaveLength(1);

      expect(await closeCampaign("c1")).toMatchObject({
        outcome: "success",
        value: { closed: true },
      });
      expect(getCampaignSession("c1")).toBeUndefined();
      expect(pendingEnvelopesForExecution("c1", snapshot)).toEqual([]);
    });

    it("also drops the session's construction workspace (it used to leak)", async () => {
      register("c3");
      getConstructionWorkspace(getCampaignSession("c3")!);
      expect(hasConstructionWorkspace("c3")).toBe(true);
      await closeCampaign("c3");
      expect(hasConstructionWorkspace("c3")).toBe(false);
    });

    it("answers SESSION_NOT_FOUND the second time (the shell treats that as already closed)", async () => {
      register("c2");
      await closeCampaign("c2");
      expect(await closeCampaign("c2")).toMatchObject({
        outcome: "error",
        reason: "SESSION_NOT_FOUND",
      });
    });
  });

  describe("copyCampaign", () => {
    it("writes a loadable copy with the session sidecar, leaving the original untouched", async () => {
      const { saveDir, state } = register("k1");
      const copyDir = resolve(root, "the-copy");
      chooseCopyDirectoryAnswer = copyDir;
      const result = await copyCampaign("k1");
      expect(result).toMatchObject({
        outcome: "success",
        value: { revision: 0, location: copyDir },
      });

      expect(savesIn(copyDir)).toBe(1);
      expect(readSessionMetadata(copyDir)).toMatchObject({ playerSlotId: "uk" });
      const loaded = new SaveStore().load(copyDir, new DiagnosticCollector());
      expect(loaded).not.toBeNull();
      expect(Number(loaded!.snapshot.turnNumber)).toBe(Number(state.snapshot.turnNumber));
      expect(savesIn(saveDir)).toBe(1);
      expect(getCampaignSession("k1")?.saveDir).toBe(saveDir);
    });

    it("does nothing when the player cancels the dialog", async () => {
      register("k2");
      chooseCopyDirectoryAnswer = null;
      const result = await copyCampaign("k2");
      expect(result).toMatchObject({ outcome: "rejected", reason: "SAVE_LOCATION_CANCELLED" });
    });

    it("refuses to copy a campaign onto itself", async () => {
      const { saveDir } = register("k3");
      chooseCopyDirectoryAnswer = saveDir;
      const result = await copyCampaign("k3");
      expect(result).toMatchObject({ outcome: "rejected", reason: "COPY_TARGET_IS_SOURCE" });
      expect(savesIn(saveDir)).toBe(1);
    });

    describe("target safety", () => {
      const ask = (target: string) => {
        chooseCopyDirectoryAnswer = target;
      };

      it("refuses another spelling of the source folder (trailing slash, ./, symlink)", async () => {
        const { saveDir } = register("t1");
        for (const spelled of [`${saveDir}/`, `${saveDir}/../t1`, `${saveDir}/.`]) {
          ask(spelled);
          expect(await copyCampaign("t1")).toMatchObject({
            outcome: "rejected",
            reason: "COPY_TARGET_IS_SOURCE",
          });
        }
        const link = resolve(root, "link-to-t1");
        symlinkSync(saveDir, link);
        ask(link);
        expect(await copyCampaign("t1")).toMatchObject({
          outcome: "rejected",
          reason: "COPY_TARGET_IS_SOURCE",
        });
        expect(savesIn(saveDir)).toBe(1);
      });

      it("refuses a target inside the source, or a folder that contains the source", async () => {
        const { saveDir } = register("t2");
        ask(resolve(saveDir, "nested"));
        expect(await copyCampaign("t2")).toMatchObject({
          outcome: "rejected",
          reason: "COPY_TARGET_INSIDE_SOURCE",
        });
        ask(root);
        expect(await copyCampaign("t2")).toMatchObject({
          outcome: "rejected",
          reason: "COPY_TARGET_CONTAINS_SOURCE",
        });
        expect(existsSync(resolve(saveDir, "nested"))).toBe(false);
      });

      it("never merges into another campaign's package or overwrites its session file", async () => {
        register("t3");
        const other = register("t3-other");
        const before = readSessionMetadata(other.saveDir);
        ask(other.saveDir);
        const result = await copyCampaign("t3");
        expect(result).toMatchObject({ outcome: "rejected", reason: "COPY_TARGET_NOT_EMPTY" });
        expect(savesIn(other.saveDir)).toBe(1);
        expect(readSessionMetadata(other.saveDir)).toEqual(before);
      });

      it("accepts an existing EMPTY folder, and refuses a file", async () => {
        register("t4");
        const empty = resolve(root, "empty");
        mkdirSync(empty);
        ask(empty);
        expect(await copyCampaign("t4")).toMatchObject({ outcome: "success" });
        expect(savesIn(empty)).toBe(1);

        const file = resolve(root, "a-file");
        writeFileSync(file, "x");
        ask(file);
        expect(await copyCampaign("t4")).toMatchObject({
          outcome: "rejected",
          reason: "COPY_TARGET_NOT_A_DIRECTORY",
        });
      });

      it("refuses, before asking anything, when the campaign has no session file to carry over", async () => {
        const { saveDir } = register("t5");
        rmSync(join(saveDir, SESSION_METADATA_FILENAME));
        chooseCopyDirectoryAnswer = resolve(root, "x");
        const result = await copyCampaign("t5");
        expect(result).toMatchObject({ outcome: "error", reason: "SESSION_METADATA_MISSING" });
        expect(chooseCopyDirectoryCalls).toBe(0);
        expect(existsSync(resolve(root, "x"))).toBe(false);
      });

      it("assessCopyTarget accepts a brand-new sibling folder", async () => {
        const { saveDir } = register("t6");
        const problem = await runtime.runPromise(
          Effect.gen(function* () {
            const projects = yield* ProjectStore;
            return yield* projects.assessCopyTarget(saveDir, resolve(root, "brand-new"));
          }),
        );
        expect(problem).toBeNull();
      });
    });

    it("fails honestly for an unknown session without asking the player anything", async () => {
      chooseCopyDirectoryAnswer = null;
      const result = await copyCampaign("nope");
      expect(result).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
      expect(chooseCopyDirectoryCalls).toBe(0);
    });
  });
});
