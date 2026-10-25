import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignSnapshot, CampaignState } from "@bluewave/campaign";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { FIXTURE_FLEET_MANAGEMENT_RULES } from "@bluewave/test-support";
import { Effect, Layer, ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  FleetScreenProjection,
  SpecialTrainingOutcome,
  TrainingSubjectId,
} from "../../shared/fleet-contract.js";
import { clearCampaignSessionsForTest, registerCampaignSession } from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { ContentArtifact, contentArtifactLayer } from "../runtime/contentArtifact.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import { inspectFleetScreenProgram, submitSpecialTrainingProgram } from "./fleetCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_ARTIFACT = resolve(__dirname, "../../../../..", "content", "generated", "1880");

const withSection = Layer.effect(
  ContentArtifact,
  Effect.gen(function* () {
    const real = yield* ContentArtifact;
    return {
      ...real,
      loadFleetManagementRules: () => Effect.succeed(FIXTURE_FLEET_MANAGEMENT_RULES),
    };
  }),
).pipe(Layer.provide(contentArtifactLayer()));

const sectionRuntime = ManagedRuntime.make(Layer.mergeAll(desktopMainLayer(), withSection));
const withoutSection = Layer.effect(
  ContentArtifact,
  Effect.gen(function* () {
    const real = yield* ContentArtifact;
    return { ...real, loadFleetManagementRules: () => Effect.succeed(undefined) };
  }),
).pipe(Layer.provide(contentArtifactLayer()));

const dormantRuntime = ManagedRuntime.make(Layer.mergeAll(desktopMainLayer(), withoutSection));

type TestRuntime = typeof sectionRuntime;

async function run<A>(
  runtime: TestRuntime,
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<A>> {
  return projectCommandExit(
    await runtime.runPromiseExit(programFor(program)(payload)),
  ) as BridgeResult<A>;
}

describe("special training commands", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-training-"));
  });
  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  function registerSession(sessionId: string): void {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
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
  }

  async function fleet(runtime: TestRuntime, sessionId: string): Promise<FleetScreenProjection> {
    const result = await run<FleetScreenProjection>(runtime, inspectFleetScreenProgram, sessionId);
    if (result.outcome !== "success") throw new Error(`inspect failed: ${result.reason}`);
    return result.value;
  }

  const fund = (
    runtime: TestRuntime,
    sessionId: string,
    revision: number,
    subjects: TrainingSubjectId[],
  ) =>
    run<SpecialTrainingOutcome>(runtime, submitSpecialTrainingProgram, {
      sessionId,
      expectedRevision: revision,
      transportRequestId: `req-${revision}-${subjects.join("-")}`,
      subjects,
    });

  async function commit(runtime: TestRuntime, sessionId: string, revision: number) {
    const result = await run<CommitMonthResponse>(runtime, commitMonthProgram, {
      sessionId,
      expectedRevision: revision,
      transportRequestId: `commit-${revision}`,
    });
    expect(result.outcome).toBe("success");
  }

  it("shows no training controls and refuses funding while the section is dormant", async () => {
    registerSession("dormant");
    expect((await fleet(dormantRuntime, "dormant")).training).toBeUndefined();
    const refused = await fund(dormantRuntime, "dormant", 0, ["GUNNERY"]);
    expect(refused).toMatchObject({ outcome: "rejected", reason: "TRAINING_DORMANT" });
  });

  it("funds two subjects, counts a funded month on each commit and resets what is dropped", async () => {
    registerSession("fund");
    const before = await fleet(sectionRuntime, "fund");
    expect(before.training?.maxSubjects).toBe(2);
    expect(
      before.training?.subjects.map((s) => [s.subject, s.funded, s.maintenanceAdderBp]),
    ).toEqual([
      ["GUNNERY", false, 3000],
      ["NIGHT_FIGHTING", false, 2000],
      ["TORPEDO_TACTICS", false, 2000],
      ["DAMAGE_CONTROL", false, 2000],
    ]);

    const queued = await fund(sectionRuntime, "fund", before.revision, [
      "GUNNERY",
      "DAMAGE_CONTROL",
    ]);
    expect(queued).toMatchObject({ outcome: "success", value: { appliedOnNextTurn: true } });
    await commit(sectionRuntime, "fund", before.revision);

    const first = await fleet(sectionRuntime, "fund");
    expect(
      first.training?.subjects.filter((s) => s.funded).map((s) => [s.subject, s.fundedMonths]),
    ).toEqual([
      ["GUNNERY", 1],
      ["DAMAGE_CONTROL", 1],
    ]);

    await commit(sectionRuntime, "fund", first.revision);
    const second = await fleet(sectionRuntime, "fund");
    expect(second.training?.subjects.find((s) => s.subject === "GUNNERY")?.fundedMonths).toBe(2);

    await fund(sectionRuntime, "fund", second.revision, ["GUNNERY"]);
    await commit(sectionRuntime, "fund", second.revision);
    const third = await fleet(sectionRuntime, "fund");
    expect(
      third.training?.subjects.filter((s) => s.funded).map((s) => [s.subject, s.fundedMonths]),
    ).toEqual([["GUNNERY", 3]]);
  });

  it("refuses a third subject with the typed limit code", async () => {
    registerSession("limit");
    const before = await fleet(sectionRuntime, "limit");
    const refused = await fund(sectionRuntime, "limit", before.revision, [
      "GUNNERY",
      "NIGHT_FIGHTING",
      "DAMAGE_CONTROL",
    ]);
    expect(refused).toMatchObject({
      outcome: "rejected",
      reason: "TRAINING_SUBJECT_LIMIT_EXCEEDED",
    });
  });
});
