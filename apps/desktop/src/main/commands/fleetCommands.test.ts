import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignState } from "@bluewave/campaign";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  CancelMovementCommandPayload,
  FleetScreenProjection,
  MovementCommandOutcome,
  ReplaceMovementCommandPayload,
  StationAssignmentOutcome,
  SubmitMovementCommandPayload,
  SubmitStationAssignmentPayload,
} from "../../shared/fleet-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import {
  cancelMovementCommandProgram,
  inspectFleetScreenProgram,
  replaceMovementCommandProgram,
  submitMovementCommandProgram,
  submitStationAssignmentProgram,
} from "./fleetCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

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

const inspectFleetScreen = (sessionId: string) =>
  runProgram<FleetScreenProjection>(inspectFleetScreenProgram, sessionId);
const submitMovementCommand = (payload: SubmitMovementCommandPayload) =>
  runProgram<MovementCommandOutcome>(submitMovementCommandProgram, payload);
const replaceMovementCommand = (payload: ReplaceMovementCommandPayload) =>
  runProgram<MovementCommandOutcome>(replaceMovementCommandProgram, payload);
const cancelMovementCommand = (payload: CancelMovementCommandPayload) =>
  runProgram<MovementCommandOutcome>(cancelMovementCommandProgram, payload);
const submitStationAssignment = (payload: SubmitStationAssignmentPayload) =>
  runProgram<StationAssignmentOutcome>(submitStationAssignmentProgram, payload);
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);

describe("fleet commands (Effect programs)", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-fleet-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    restartRuntime();
  });

  function registerProductionSession(
    sessionId: string,
    saveDir: string,
    playerSlotId: string,
  ): CampaignState {
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
      playerSlotId,
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });
    return state;
  }

  it("returns SESSION_NOT_FOUND for an unregistered session on every command", async () => {
    const inspect = await inspectFleetScreen("no-such-session");
    expect(inspect).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });

    const submit = await submitMovementCommand({
      sessionId: "no-such-session",
      divisionId: "fleet_gbr_home",
      fromAreaId: "eng_home_coast",
      toAreaId: "sea_english_channel",
      expectedRevision: 0,
      transportRequestId: "tx-0",
    });
    expect(submit).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });

    const replace = await replaceMovementCommand({
      sessionId: "no-such-session",
      commandId: "cmd-x",
      divisionId: "fleet_gbr_home",
      fromAreaId: "eng_home_coast",
      toAreaId: "sea_english_channel",
      expectedRevision: 0,
      transportRequestId: "tx-0",
    });
    expect(replace).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });

    const cancel = await cancelMovementCommand({
      sessionId: "no-such-session",
      commandId: "cmd-x",
      expectedRevision: 0,
      transportRequestId: "tx-0",
    });
    expect(cancel).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
  });

  it("rejects a malformed wire payload at the schema boundary", async () => {
    const inspect = await runProgram(inspectFleetScreenProgram, { sessionId: 123 });
    expect(inspect).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });

    const submit = await runProgram(submitMovementCommandProgram, {
      sessionId: "mv",
      divisionId: "fleet_gbr_home",
      fromAreaId: "eng_home_coast",
      toAreaId: "sea_english_channel",
      expectedRevision: -1,
      transportRequestId: "tx-0",
    });
    expect(submit).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
  });

  it("shows the player nation's real divisions, ships, and ports for the open campaign", async () => {
    const saveDir = resolve(saveRoot, "save-uk");
    const state = registerProductionSession("session-uk", saveDir, "uk");

    const result = await inspectFleetScreen("session-uk");
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    const projection = result.value;
    expect(projection.revision).toBe(0);
    expect(projection.month).toEqual({ month: 1, year: 1880 });
    expect(projection.playerNationId).toBe("uk");

    const uk = state.snapshot.nations.get("uk")!;
    expect(projection.divisions).toHaveLength(uk.fleets.length);
    expect(uk.fleets.length).toBeGreaterThan(0);

    const homeFleet = uk.fleets.find((f) => f.id === "fleet_gbr_home");
    expect(homeFleet).toBeDefined();
    const homeView = projection.divisions.find((d) => d.divisionId === "fleet_gbr_home");
    expect(homeView).toBeDefined();
    expect(homeView!.fleetName).toBe(homeFleet!.name);
    expect(homeView!.areaId).toBe(homeFleet!.locationAreaId);
    expect(homeView!.ships).toHaveLength(homeFleet!.ships.length);

    const inflexible = homeView!.ships.find((s) => s.name === "HMS Inflexible");
    expect(inflexible).toBeDefined();
    const compiledInflexible = homeFleet!.ships.find((s) => s.id === "gbr_inflexible")!;
    expect(compiledInflexible.designVersionId).toBe("des_gbr_inflexible");
    expect(inflexible!.designId).toBe(compiledInflexible.designVersionId);
    expect(inflexible!.status).toBe("working_up");
    const dreadnought = homeView!.ships.find((s) => s.name === "HMS Dreadnought");
    expect(dreadnought).toBeDefined();
    expect(dreadnought!.status).toBe("active");

    expect(projection.movementCommands).toEqual([]);

    expect(projection.areas).toHaveLength(state.snapshot.world.areas.length);
    expect(projection.areas.length).toBeGreaterThan(0);
    expect(projection.areaEdges).toHaveLength(state.snapshot.world.routes.length);
    expect(projection.areaEdges.length).toBeGreaterThan(0);

    const ukPorts = state.snapshot.world.ports.filter((p) => p.nationId === "uk");
    expect(projection.ports).toHaveLength(ukPorts.length);
    expect(ukPorts.length).toBeGreaterThan(0);
    const portsmouth = projection.ports.find((p) => p.id === "gbr_portsmouth");
    expect(portsmouth).toBeDefined();
    expect(portsmouth!.name).toBe("Portsmouth");
    expect(portsmouth!.areaId).toBe("eng_home_coast");
    expect(portsmouth!.capacity).toBe(
      Number(ukPorts.find((p) => p.id === "gbr_portsmouth")!.level),
    );
  });

  it("carries ship ids and the live presence readout (S-5 09, production pack authors the section, ADR-0266)", async () => {
    registerProductionSession("session-uk-presence", resolve(saveRoot, "save-uk-p"), "uk");
    const result = await inspectFleetScreen("session-uk-presence");
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;
    const home = result.value.divisions.find((d) => d.divisionId === "fleet_gbr_home")!;
    expect(home.ships.map((s) => s.shipId)).toContain("gbr_dreadnought");
    const { presence } = result.value;
    expect(presence.configured).toBe(true);
    if (!presence.configured) return;
    expect(presence.exempt).toBe(false);
    expect(presence.areas.length).toBeGreaterThan(0);
    for (const area of presence.areas) {
      expect(area.requiredTons).toBeGreaterThan(0);
      expect(area.requiredTons % 150).toBe(0);
      expect(area.shortfallTons).toBe(Math.max(0, area.requiredTons - area.presentTons));
    }
    expect(result.value.overBaseShips).toEqual([]);
  });

  describe("station assignment (S-5 09)", () => {
    const base = { expectedRevision: 0 };

    it("queues an assign for an active ship and a clear is then rejected whole with the typed reason", async () => {
      registerProductionSession("session-station", resolve(saveRoot, "save-station"), "uk");
      const assigned = await submitStationAssignment({
        ...base,
        sessionId: "session-station",
        transportRequestId: "tx-assign",
        intent: "assign",
        shipIds: ["gbr_dreadnought"],
      });
      expect(assigned).toMatchObject({
        outcome: "success",
        value: { intent: "assign", shipCount: 1, appliedOnNextTurn: true },
      });

      const cleared = await submitStationAssignment({
        ...base,
        sessionId: "session-station",
        transportRequestId: "tx-clear",
        intent: "clear",
        shipIds: ["gbr_dreadnought"],
      });
      expect(cleared).toMatchObject({ outcome: "rejected", reason: "STATION_ASSIGNMENT_REJECTED" });
      if (cleared.outcome !== "rejected") return;
      expect(cleared.diagnostics.join(" ")).toContain("gbr_dreadnought=NOT_ASSIGNED");
    });

    it("replays the same transport request and rejects a conflicting selection under it", async () => {
      registerProductionSession("session-station3", resolve(saveRoot, "save-station3"), "uk");
      const request = {
        ...base,
        sessionId: "session-station3",
        transportRequestId: "tx-same",
        intent: "assign" as const,
        shipIds: ["gbr_dreadnought"],
      };
      const first = await submitStationAssignment(request);
      expect(first).toMatchObject({ outcome: "success" });
      const replay = await submitStationAssignment(request);
      expect(replay).toEqual(first);

      const conflict = await submitStationAssignment({ ...request, intent: "clear" });
      expect(conflict).toMatchObject({ outcome: "rejected", reason: "IDEMPOTENCY_CONFLICT" });
    });

    it("rejects an unknown ship with every reason named and does not queue", async () => {
      registerProductionSession("session-station2", resolve(saveRoot, "save-station2"), "uk");
      const result = await submitStationAssignment({
        ...base,
        sessionId: "session-station2",
        transportRequestId: "tx-bad",
        intent: "assign",
        shipIds: ["gbr_dreadnought", "nope"],
      });
      expect(result).toMatchObject({ outcome: "rejected", reason: "STATION_ASSIGNMENT_REJECTED" });
      if (result.outcome !== "rejected") return;
      expect(result.diagnostics.join(" ")).toContain("nope=NOT_OWNED");
    });

    it("rejects an empty or malformed selection at the schema boundary", async () => {
      const result = await runProgram(submitStationAssignmentProgram, {
        sessionId: "s",
        expectedRevision: 0,
        transportRequestId: "tx",
        intent: "assign",
        shipIds: [],
      });
      expect(result).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
      const badIntent = await runProgram(submitStationAssignmentProgram, {
        sessionId: "s",
        expectedRevision: 0,
        transportRequestId: "tx",
        intent: "toggle",
        shipIds: ["a"],
      });
      expect(badIntent).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
    });
  });

  it("excludes non-player nations' fleets and ports from the projection", async () => {
    const saveDir = resolve(saveRoot, "save-france");
    const state = registerProductionSession("france-session", saveDir, "france");

    const result = await inspectFleetScreen("france-session");
    expect(result.outcome).toBe("success");
    if (result.outcome !== "success") return;

    const projection = result.value;
    expect(projection.playerNationId).toBe("france");

    const france = state.snapshot.nations.get("france")!;
    const frenchFleetIds = new Set(france.fleets.map((f) => f.id));
    expect(projection.divisions).toHaveLength(france.fleets.length);
    for (const division of projection.divisions) {
      expect(frenchFleetIds.has(division.divisionId)).toBe(true);
    }
    const ukShipNames = new Set(
      [...state.snapshot.nations.get("uk")!.fleets].flatMap((f) => f.ships.map((s) => s.name)),
    );
    for (const division of projection.divisions) {
      for (const ship of division.ships) {
        expect(ukShipNames.has(ship.name)).toBe(false);
      }
    }

    const frenchPortIds = new Set(
      state.snapshot.world.ports.filter((p) => p.nationId === "france").map((p) => p.id),
    );
    expect(projection.ports).toHaveLength(frenchPortIds.size);
    expect(frenchPortIds.size).toBeGreaterThan(0);
    for (const port of projection.ports) {
      expect(frenchPortIds.has(port.id)).toBe(true);
      expect(port.id.startsWith("fra_")).toBe(true);
    }
  });

  describe("movement orders (ADR-0062)", () => {
    function submit(over: Partial<SubmitMovementCommandPayload> = {}) {
      return submitMovementCommand({
        sessionId: "mv",
        divisionId: "fleet_gbr_home",
        fromAreaId: "eng_home_coast",
        toAreaId: "sea_english_channel",
        expectedRevision: 0,
        transportRequestId: "tx-1",
        ...over,
      });
    }
    async function listed() {
      const result = await inspectFleetScreen("mv");
      if (result.outcome !== "success") throw new Error(result.reason);
      return result.value.movementCommands;
    }

    it("queues a legal one-hop order, lists it, and the engine moves the fleet when the month is committed", async () => {
      registerProductionSession("mv", resolve(saveRoot, "mv"), "uk");
      const result = await submit();
      expect(result).toMatchObject({
        outcome: "success",
        value: { command: { status: "submitted" } },
      });
      expect(await listed()).toEqual([
        expect.objectContaining({
          divisionId: "fleet_gbr_home",
          fromAreaId: "eng_home_coast",
          toAreaId: "sea_english_channel",
          status: "submitted",
        }),
      ]);
      const before = getCampaignSession("mv")!.state.snapshot.nations.get("uk")!;
      expect(before.fleets.find((f) => f.id === "fleet_gbr_home")!.locationAreaId).toBe(
        "eng_home_coast",
      );

      const committed = await commitMonth({
        sessionId: "mv",
        expectedRevision: 0,
        transportRequestId: "commit-mv",
      });
      expect(committed.outcome).toBe("success");
      const after = getCampaignSession("mv")!.state.snapshot.nations.get("uk")!;
      const fleet = after.fleets.find((f) => f.id === "fleet_gbr_home")!;
      expect(fleet.locationAreaId).toBe("sea_english_channel");
      expect(fleet.ships.every((s) => s.locationAreaId === "sea_english_channel")).toBe(true);
      expect(await listed()).toEqual([]);
    });

    it("rejects an illegal destination with the engine's code and queues nothing", async () => {
      registerProductionSession("mv", resolve(saveRoot, "mv"), "uk");
      const result = await submit({ toAreaId: "sea_baltic" });
      expect(result).toMatchObject({ outcome: "rejected", reason: "INVALID_ROUTE" });
      expect(await listed()).toEqual([]);
    });

    it("rejects a stale revision without queueing", async () => {
      registerProductionSession("mv", resolve(saveRoot, "mv"), "uk");
      const result = await submit({ expectedRevision: 5, transportRequestId: "tx-stale" });
      expect(result).toMatchObject({ outcome: "rejected", reason: "REVISION_MISMATCH" });
      expect(await listed()).toEqual([]);
    });

    it("replays the same transport request and rejects a conflicting body (idempotency)", async () => {
      registerProductionSession("mv", resolve(saveRoot, "mv"), "uk");
      const first = await submit();
      expect(first.outcome).toBe("success");
      const replay = await submit();
      expect(replay).toMatchObject({ outcome: "success" });
      if (first.outcome === "success" && replay.outcome === "success") {
        expect(replay.value.command.commandId).toBe(first.value.command.commandId);
      }
      expect(await listed()).toHaveLength(1);
      const conflict = await submit({ toAreaId: "sea_north_sea" });
      expect(conflict).toMatchObject({ outcome: "rejected", reason: "IDEMPOTENCY_CONFLICT" });
      expect(await listed()).toHaveLength(1);
    });

    it("keeps one order per fleet: a second order replaces the first, and cancel drops it", async () => {
      registerProductionSession("mv", resolve(saveRoot, "mv"), "uk");
      await submit();
      await submit({ toAreaId: "sea_north_sea", transportRequestId: "tx-2" });
      const orders = await listed();
      expect(orders).toHaveLength(1);
      expect(orders[0]!.toAreaId).toBe("sea_north_sea");

      const replaced = await replaceMovementCommand({
        sessionId: "mv",
        commandId: orders[0]!.commandId,
        divisionId: "fleet_gbr_home",
        fromAreaId: "eng_home_coast",
        toAreaId: "sea_english_channel",
        expectedRevision: 0,
        transportRequestId: "tx-3",
      });
      expect(replaced.outcome).toBe("success");
      expect((await listed())[0]!.toAreaId).toBe("sea_english_channel");

      const cancelled = await cancelMovementCommand({
        sessionId: "mv",
        commandId: orders[0]!.commandId,
        expectedRevision: 0,
        transportRequestId: "tx-4",
      });
      expect(cancelled).toMatchObject({
        outcome: "success",
        value: { command: { status: "cancelled" } },
      });
      expect(await listed()).toEqual([]);
    });

    it("rejects cancelling or replacing an order that does not exist", async () => {
      registerProductionSession("mv", resolve(saveRoot, "mv"), "uk");
      const cancel = await cancelMovementCommand({
        sessionId: "mv",
        commandId: "nope",
        expectedRevision: 0,
        transportRequestId: "tx-9",
      });
      expect(cancel).toMatchObject({ outcome: "rejected", reason: "COMMAND_NOT_FOUND" });

      const replace = await replaceMovementCommand({
        sessionId: "mv",
        commandId: "nope",
        divisionId: "fleet_gbr_home",
        fromAreaId: "eng_home_coast",
        toAreaId: "sea_english_channel",
        expectedRevision: 0,
        transportRequestId: "tx-9",
      });
      expect(replace).toMatchObject({ outcome: "rejected", reason: "COMMAND_NOT_FOUND" });
    });
  });
});
