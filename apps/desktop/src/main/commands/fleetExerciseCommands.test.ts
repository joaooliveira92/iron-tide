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
import type { FleetExerciseOutcome, FleetScreenProjection } from "../../shared/fleet-contract.js";
import { clearCampaignSessionsForTest, registerCampaignSession } from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { ContentArtifact, contentArtifactLayer } from "../runtime/contentArtifact.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import { inspectFleetScreenProgram, submitFleetExerciseProgram } from "./fleetCommands.js";

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
const dormantRuntime = ManagedRuntime.make(desktopMainLayer());

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

describe("fleet exercise commands", () => {
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

  const hold = (runtime: TestRuntime, sessionId: string, revision: number, shipIds: string[]) =>
    run<FleetExerciseOutcome>(runtime, submitFleetExerciseProgram, {
      sessionId,
      expectedRevision: revision,
      transportRequestId: `req-${revision}-${shipIds.join("-")}`,
      shipIds,
    });

  async function commit(runtime: TestRuntime, sessionId: string, revision: number) {
    const result = await run<CommitMonthResponse>(runtime, commitMonthProgram, {
      sessionId,
      expectedRevision: revision,
      transportRequestId: `commit-${revision}`,
    });
    expect(result.outcome).toBe("success");
  }

  const firstShips = (view: FleetScreenProjection, count: number) =>
    view.divisions
      .flatMap((division) => division.ships)
      .filter((ship) => ship.readiness === "ACTIVE")
      .slice(0, count)
      .map((ship) => ship.shipId);

  it("shows no exercise controls and refuses an order while the section is dormant", async () => {
    registerSession("dormant");
    const view = await fleet(dormantRuntime, "dormant");
    expect(view.exercise).toBeUndefined();
    const refused = await hold(dormantRuntime, "dormant", 0, firstShips(view, 1));
    expect(refused).toMatchObject({ outcome: "rejected", reason: "FLEET_EXERCISE_DORMANT" });
  });

  it("schedules the exercise, marks the ships, holds it the next month and then refuses a second in the year", async () => {
    registerSession("held");
    const before = await fleet(sectionRuntime, "held");
    expect(before.exercise).toMatchObject({
      maxPerCalendarYear: 1,
      maintenanceMultiple: 2,
      experienceGain: 5,
      nextExerciseYear: 1880,
      heldInNextExerciseYear: 0,
    });
    const ships = firstShips(before, 2);
    expect(ships).toHaveLength(2);

    const queued = await hold(sectionRuntime, "held", before.revision, ships);
    expect(queued).toMatchObject({ outcome: "success", value: { shipCount: 2 } });
    await commit(sectionRuntime, "held", before.revision);

    const scheduled = await fleet(sectionRuntime, "held");
    expect(scheduled.exercise?.scheduled?.shipIds).toEqual([...ships].sort());
    expect(scheduled.exercise?.heldInNextExerciseYear).toBe(1);
    const marked = scheduled.divisions
      .flatMap((division) => division.ships)
      .filter((ship) => ship.stationCode === "EX")
      .map((ship) => ship.shipId);
    expect(marked.sort()).toEqual([...ships].sort());

    await commit(sectionRuntime, "held", scheduled.revision);
    const held = await fleet(sectionRuntime, "held");
    expect(held.exercise?.scheduled).toBeUndefined();
    expect(
      held.divisions
        .flatMap((division) => division.ships)
        .some((ship) => ship.stationCode === "EX"),
    ).toBe(false);

    const again = await hold(sectionRuntime, "held", held.revision, firstShips(held, 1));
    expect(again).toMatchObject({ outcome: "rejected", reason: "FLEET_EXERCISE_LIMIT_REACHED" });
  });
});
