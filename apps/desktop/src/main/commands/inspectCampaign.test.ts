import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignCompilerOutput } from "@bluewave/campaign/compiler";
import {
  buildBattleHistory,
  buildOpeningBriefingProjection,
  buildPrioritiesProjection,
  buildStrategicMapView,
  type InspectPrioritiesResult,
} from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { ManagedRuntime } from "effect";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  InspectBattleHistoryResult,
  InspectCampaignResult,
  InspectMapResult,
  InspectOpeningBriefingResult,
} from "../../shared/campaign-command-contract.js";
import { clearCampaignSessionsForTest, registerCampaignSession } from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { inspectBattleHistoryProgram } from "./inspectBattleHistory.js";
import { inspectCampaignProgram } from "./inspectCampaign.js";
import { inspectMapProgram } from "./inspectMap.js";
import { inspectOpeningBriefingProgram } from "./inspectOpeningBriefing.js";
import { inspectPrioritiesProgram } from "./inspectPriorities.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

const runtime = ManagedRuntime.make(desktopMainLayer());

async function runProgram(
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<unknown>> {
  return projectCommandExit(await runtime.runPromiseExit(programFor(program)(payload)));
}

const PROGRAMS: ReadonlyArray<readonly [string, AnyCommandHandler]> = [
  ["inspectCampaign", inspectCampaignProgram],
  ["inspectMap", inspectMapProgram],
  ["inspectBattleHistory", inspectBattleHistoryProgram],
  ["inspectOpeningBriefing", inspectOpeningBriefingProgram],
  ["inspectPriorities", inspectPrioritiesProgram],
];

describe("inspect commands (Effect programs)", () => {
  let compiled: CampaignCompilerOutput;

  beforeAll(() => {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");
    compiled = output;
  });

  beforeEach(() => {
    registerSession("session-uk");
  });

  afterEach(() => {
    clearCampaignSessionsForTest();
  });

  function registerSession(sessionId: string, playerSlotId = "uk"): void {
    registerCampaignSession({
      sessionId,
      saveDir: "/tmp/unused-in-this-test",
      playerSlotId,
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state: compiled.state,
    });
  }

  it("answers SESSION_NOT_FOUND for an unregistered session", async () => {
    for (const [command, program] of PROGRAMS) {
      const result = await runProgram(program, "no-such-session");
      expect(result, command).toMatchObject({
        outcome: "error",
        reason: "SESSION_NOT_FOUND",
      });
    }
  });

  it("rejects a non-string payload at the schema boundary", async () => {
    for (const [command, program] of PROGRAMS) {
      const result = await runProgram(program, { sessionId: 123 });
      expect(result, command).toMatchObject({
        outcome: "error",
        reason: "INVALID_PAYLOAD",
      });
    }
  });

  describe("inspectCampaign", () => {
    it("returns real, non-placeholder treasury/fleet/technologies/ports/strategic areas for the compiled campaign", async () => {
      const snapshot = compiled.state.snapshot;
      const ukNation = snapshot.nations.get("uk")!;

      const result = await runProgram(inspectCampaignProgram, "session-uk");
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const { projection } = result.value as InspectCampaignResult;

      expect(projection.campaignIdentity).toBe(snapshot.campaignId);
      expect(projection.economy.treasury).toBe(Number(ukNation.treasury));
      expect(projection.month).toEqual({ month: 1, year: 1880 });
      expect(projection.playerNationId).toBe("uk");

      const expectedFleetCount = ukNation.fleets.length;
      expect(projection.fleet).toHaveLength(expectedFleetCount);
      expect(expectedFleetCount).toBeGreaterThan(0);
      const totalShips = projection.fleet.reduce(
        (sum, fleet) => sum + fleet.divisions.reduce((s, d) => s + d.ships.length, 0),
        0,
      );
      const expectedShipCount = ukNation.fleets.reduce((sum, f) => sum + f.ships.length, 0);
      expect(totalShips).toBe(expectedShipCount);

      const expectedPorts = snapshot.world.ports.filter((p) => p.nationId === "uk");
      expect(projection.ports).toHaveLength(expectedPorts.length);
      expect(expectedPorts.length).toBeGreaterThan(0);

      expect(projection.knownTechnologyIds).toEqual(
        [...ukNation.research.discoveredTechs].sort((a, b) => a.localeCompare(b)),
      );

      const expectedStrategicAreas = snapshot.world.areas.filter((a) => a.controller === "uk");
      expect(projection.strategicAreas).toHaveLength(expectedStrategicAreas.length);
      expect(expectedStrategicAreas.length).toBeGreaterThan(0);
    });

    it("reports PROJECTION_FAILED for a session whose player slot is not in the snapshot", async () => {
      registerSession("session-bogus", "atlantis");
      const result = await runProgram(inspectCampaignProgram, "session-bogus");
      expect(result).toMatchObject({ outcome: "error", reason: "PROJECTION_FAILED" });
    });
  });

  describe("inspectMap", () => {
    it("rebuilds the viewer-scoped strategic projection from the session's stored snapshot", async () => {
      const result = await runProgram(inspectMapProgram, "session-uk");
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const value = result.value as InspectMapResult;
      expect(value.revision).toBe(0);
      expect(value.month).toEqual({ month: 1, year: 1880 });
      expect(value.playerNationId).toBe("uk");
      expect(value.strategic).toEqual(buildStrategicMapView(compiled.state.snapshot, "uk"));
    });

    it("reports UNKNOWN_PLAYER_SLOT for a session whose player slot is not in the snapshot", async () => {
      registerSession("session-bogus", "atlantis");
      const result = await runProgram(inspectMapProgram, "session-bogus");
      expect(result).toMatchObject({ outcome: "error", reason: "UNKNOWN_PLAYER_SLOT" });
    });
  });

  describe("inspectBattleHistory", () => {
    it("rebuilds the player's resolved battles from the session's stored snapshot", async () => {
      const result = await runProgram(inspectBattleHistoryProgram, "session-uk");
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const value = result.value as InspectBattleHistoryResult;
      expect(value.revision).toBe(0);
      expect(value.history).toEqual(buildBattleHistory(compiled.state.snapshot, "uk"));
    });
  });

  describe("inspectOpeningBriefing", () => {
    it("rebuilds the briefing projection from the session's stored state", async () => {
      const result = await runProgram(inspectOpeningBriefingProgram, "session-uk");
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const value = result.value as InspectOpeningBriefingResult;
      expect(value.projection).toEqual(
        buildOpeningBriefingProjection(compiled.state, "uk", { month: 1, year: 1880 }),
      );
    });

    it("reports UNKNOWN_PLAYER_SLOT for a session whose player slot is not in the snapshot", async () => {
      registerSession("session-bogus", "atlantis");
      const result = await runProgram(inspectOpeningBriefingProgram, "session-bogus");
      expect(result).toMatchObject({ outcome: "error", reason: "UNKNOWN_PLAYER_SLOT" });
    });
  });

  describe("inspectPriorities", () => {
    it("rebuilds the priorities projection from the session's stored snapshot", async () => {
      const result = await runProgram(inspectPrioritiesProgram, "session-uk");
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const value = result.value as InspectPrioritiesResult;
      expect(value.priorities).toEqual(buildPrioritiesProjection(compiled.state.snapshot, "uk"));
    });
  });
});
