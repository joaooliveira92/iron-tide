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
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
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

  function registerSession(sessionId: string, nationId = "uk", atWar = false): void {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    if (!output) throw new Error("production pack failed to compile");
    const snapshot: CampaignSnapshot = structuredClone(output.state.snapshot);
    for (const fleet of snapshot.nations.get(nationId)!.fleets)
      for (const ship of fleet.ships)
        ship.hitPoints = (Number(ship.hitPoints) * 50) as typeof ship.hitPoints;
    if (atWar) {
      const opponent = [...snapshot.nations.keys()].find((id) => id !== nationId)!;
      snapshot.wars.wars.push({
        id: "war-test",
        attackerSideId: "side-a",
        defenderSideId: "side-b",
        attackerSideMembers: [nationId],
        defenderSideMembers: [opponent],
        attackerWarScore: 0,
        defenderWarScore: 0,
        attackerId: nationId,
        defenderId: opponent,
        startDate: "1880-01",
        status: "ACTIVE",
      });
    }
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
      playerSlotId: nationId,
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

  const chargedOf = (sessionId: string, nationId: string) =>
    Number(getCampaignSession(sessionId)!.state.snapshot.nations.get(nationId)!.maintenanceCost);

  const SELECTIONS: readonly TrainingSubjectId[][] = [
    ["GUNNERY"],
    ["NIGHT_FIGHTING"],
    ["GUNNERY", "DAMAGE_CONTROL"],
    ["NIGHT_FIGHTING", "TORPEDO_TACTICS"],
  ];

  it.each([
    ["uk", false],
    ["uk", true],
    ["japan", false],
    ["japan", true],
  ] as const)(
    "previews exactly the maintenance the engine charges next month (%s, at war: %s)",
    async (nationId, atWar) => {
      const baseId = `base-${nationId}-${atWar}`;
      registerSession(baseId, nationId, atWar);
      const base = await fleet(sectionRuntime, baseId);
      await commit(sectionRuntime, baseId, base.revision);
      const baseline = chargedOf(baseId, nationId);
      for (const subjects of SELECTIONS) {
        const id = `sel-${nationId}-${atWar}-${subjects.join("-")}`;
        registerSession(id, nationId, atWar);
        const before = await fleet(sectionRuntime, id);
        const preview = before.training?.selections.find(
          (entry) => entry.subjects.join() === subjects.join(),
        );
        expect(preview).toBeDefined();
        expect(preview!.monthlyCost).toBeGreaterThan(0);
        await fund(sectionRuntime, id, before.revision, [...subjects]);
        await commit(sectionRuntime, id, before.revision);
        expect(chargedOf(id, nationId) - baseline, subjects.join("+")).toBe(preview!.monthlyCost);
      }
    },
  );

  it("projects every valid selection once, the empty one free, and the effect only for known subjects", async () => {
    registerSession("shape");
    const projection = (await fleet(sectionRuntime, "shape")).training!;
    expect(projection.selections.map((entry) => entry.subjects.join("+"))).toEqual([
      "",
      "GUNNERY",
      "NIGHT_FIGHTING",
      "TORPEDO_TACTICS",
      "DAMAGE_CONTROL",
      "GUNNERY+NIGHT_FIGHTING",
      "GUNNERY+TORPEDO_TACTICS",
      "GUNNERY+DAMAGE_CONTROL",
      "NIGHT_FIGHTING+TORPEDO_TACTICS",
      "NIGHT_FIGHTING+DAMAGE_CONTROL",
      "TORPEDO_TACTICS+DAMAGE_CONTROL",
    ]);
    expect(projection.selections[0]!.monthlyCost).toBe(0);
    expect(projection.subjects.map((s) => [s.subject, s.effectBp])).toEqual([
      ["GUNNERY", 1000],
      ["NIGHT_FIGHTING", 1000],
      ["TORPEDO_TACTICS", 1000],
      ["DAMAGE_CONTROL", 1000],
    ]);
    for (const subject of projection.subjects) {
      expect(subject.monthlyCost).toBe(
        projection.selections.find((entry) => entry.subjects.join() === subject.subject)!
          .monthlyCost,
      );
      expect(subject.monthlyCostExplanation?.formulaId).toBe("fleet_training_cost");
    }
  });

  it("leaves the snapshot untouched when previewing", async () => {
    registerSession("pure");
    const before = structuredClone(getCampaignSession("pure")!.state.snapshot);
    await fleet(sectionRuntime, "pure");
    expect(getCampaignSession("pure")!.state.snapshot).toEqual(before);
  });
});
