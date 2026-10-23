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
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { programFor, queuedEnvelopes, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import type {
  DivisionCommandBody,
  DivisionCommandOutcome,
  DivisionScreenProjection,
  SubmitDivisionCommandPayload,
} from "../../shared/division-contract.js";
import { commitMonthProgram } from "./commitMonth.js";
import {
  inspectDivisionScreenProgram,
  newDivisionId,
  submitDivisionCommandProgram,
} from "./divisionCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_ARTIFACT = resolve(__dirname, "../../../../..", "content", "generated", "1880");

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

const inspectDivisionScreen = (sessionId: string) =>
  runProgram<DivisionScreenProjection>(inspectDivisionScreenProgram, sessionId);
const submitDivisionCommand = (payload: SubmitDivisionCommandPayload) =>
  runProgram<DivisionCommandOutcome>(submitDivisionCommandProgram, payload);
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);

const DIVISION_TYPES = new Set([
  "CreateDivision",
  "AddShipToDivision",
  "RemoveShipFromDivision",
  "ChangeDivisionFlagship",
  "ReorderDivisionShips",
  "DissolveDivision",
]);

describe("division commands", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-division-"));
  });
  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    restartRuntime();
  });

  function registerSession(sessionId: string): CampaignState {
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    expect(collector.hasErrors).toBe(false);
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
    return saveable;
  }

  async function view(sessionId: string): Promise<DivisionScreenProjection> {
    const result = await inspectDivisionScreen(sessionId);
    if (result.outcome !== "success") throw new Error(`inspect failed: ${result.reason}`);
    return result.value;
  }

  function payload(
    sessionId: string,
    command: DivisionCommandBody,
    over: { expectedRevision?: number; transportRequestId?: string } = {},
  ) {
    return {
      sessionId,
      expectedRevision: over.expectedRevision ?? 0,
      transportRequestId: over.transportRequestId ?? "req-1",
      command,
    };
  }

  function queued(sessionId: string) {
    const state = getCampaignSession(sessionId)!.state;
    return queuedEnvelopes(runtime, sessionId, state.snapshot).filter((e) =>
      DIVISION_TYPES.has(e.body.type as string),
    );
  }

  async function shipsByArea(sessionId: string) {
    const v = await view(sessionId);
    const byArea = new Map<string, string[]>();
    for (const ship of v.unassignedShips) {
      byArea.set(ship.areaId, [...(byArea.get(ship.areaId) ?? []), ship.shipId]);
    }
    return { v, byArea };
  }

  async function freeSeededDivisions(sessionId: string): Promise<DivisionScreenProjection> {
    let current = await view(sessionId);
    while (current.divisions.length > 0) {
      const divisionId = current.divisions[0]!.divisionId;
      const result = await submitDivisionCommand(
        payload(
          sessionId,
          { type: "DissolveDivision", divisionId },
          { expectedRevision: current.revision, transportRequestId: `free-${divisionId}` },
        ),
      );
      expect(result.outcome).toBe("success");
      await commit(sessionId, current.revision);
      current = await view(sessionId);
    }
    return current;
  }

  function create(
    sessionId: string,
    flagshipShipId: string,
    over: { expectedRevision?: number; transportRequestId?: string } = {},
  ) {
    return submitDivisionCommand(
      payload(
        sessionId,
        { type: "CreateDivision", flagshipShipId, role: "CORE", formation: "LINE_AHEAD" },
        over,
      ),
    );
  }

  async function commit(sessionId: string, revision: number) {
    const result = await commitMonth({
      sessionId,
      expectedRevision: revision,
      transportRequestId: `commit-${revision}`,
    });
    expect(result.outcome).toBe("success");
    return result;
  }

  describe("inspectDivisionScreen", () => {
    it("fails honestly for an unknown session", async () => {
      const result = await inspectDivisionScreen("nope");
      expect(result).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
    });

    it("projects the real production start: seeded UK divisions, no unassigned operational ships, engine limits and costs", async () => {
      registerSession("inspect");
      const v = await view("inspect");
      expect(v.revision).toBe(0);
      expect(v.divisions).toHaveLength(2);
      expect(v.divisions.map((division) => division.role)).toEqual(["CORE", "INDEPENDENT"]);
      expect(v.divisions.map((division) => division.ships.length).sort((a, b) => a - b)).toEqual([
        1, 2,
      ]);
      expect(v.unassignedShips).toEqual([]);
      expect(v.roles).toContain("CORE");
      expect(v.formations).toContain("LINE_AHEAD");
      expect(v.maxShips).toBe(5);
      expect(v.penalties.addShip).toEqual({ experience: 5, cohesion: 10 });
    });
  });

  describe("submitDivisionCommand — issue time", () => {
    it("queues a real CreateDivision envelope founded on one flagship, with a deterministic id", async () => {
      registerSession("create");
      const freed = await freeSeededDivisions("create");
      const flagship = freed.unassignedShips[0]!.shipId;
      const result = await create("create", flagship, { expectedRevision: freed.revision });
      expect(result).toMatchObject({
        outcome: "success",
        value: { bodyType: "CreateDivision", appliedOnNextTurn: true },
      });
      const envelopes = queued("create");
      expect(envelopes).toHaveLength(1);
      const body = envelopes[0]!.body as unknown as Record<string, unknown>;
      expect(body).toMatchObject({
        type: "CreateDivision",
        nationId: "uk",
        shipOrder: [flagship],
        divisionRole: "CORE",
        preferredFormation: "LINE_AHEAD",
      });
      expect(body["divisionId"]).toBe(newDivisionId("uk", freed.revision, flagship));
      expect(getCampaignSession("create")!.state.snapshot.nations.get("uk")!.divisions).toEqual([]);
    });

    it("replays an identical retry and rejects a different body under the same transportRequestId", async () => {
      registerSession("idem");
      const freed = await freeSeededDivisions("idem");
      const [first, second] = [freed.unassignedShips[0]!.shipId, freed.unassignedShips[1]!.shipId];
      const a = await create("idem", first, { expectedRevision: freed.revision });
      const replay = await create("idem", first, { expectedRevision: freed.revision });
      expect(replay).toEqual(a);
      expect(queued("idem")).toHaveLength(1);

      const conflict = await create("idem", second, { expectedRevision: freed.revision });
      expect(conflict).toMatchObject({ outcome: "rejected", reason: "IDEMPOTENCY_CONFLICT" });
      expect(queued("idem")).toHaveLength(1);
    });

    it("rejects a stale revision without queueing", async () => {
      registerSession("stale");
      const freed = await freeSeededDivisions("stale");
      const result = await create("stale", freed.unassignedShips[0]!.shipId, {
        expectedRevision: 7,
      });
      expect(result).toMatchObject({ outcome: "rejected", reason: "REVISION_MISMATCH" });
      expect(queued("stale")).toEqual([]);
    });

    it("lets the ENGINE reject an unknown ship and queues nothing", async () => {
      registerSession("unknown");
      const result = await create("unknown", "no_such_ship");
      expect(result.outcome).toBe("rejected");
      if (result.outcome === "rejected")
        expect(result.reason).toBe("DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE");
      expect(queued("unknown")).toEqual([]);
    });

    it("returns SESSION_NOT_FOUND for a submit against an unknown session", async () => {
      const result = await submitDivisionCommand(
        payload("no-such-session", {
          type: "CreateDivision",
          flagshipShipId: "gbr_dreadnought",
          role: "CORE",
          formation: "LINE_AHEAD",
        }),
      );
      expect(result).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
    });

    it("rejects a malformed wire payload at the schema boundary", async () => {
      const result = await runProgram(submitDivisionCommandProgram, {
        sessionId: "b",
        expectedRevision: 0,
        transportRequestId: "req-x",
        command: { type: "CreateDivision", flagshipShipId: "", role: "CORE", formation: "LINE" },
      });
      expect(result).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
    });
  });

  describe("applied by commitMonth (the engine is the only mutator)", () => {
    it("founds a division on exactly its flagship (the engine's real semantics) with a vacant commander", async () => {
      registerSession("found");
      const freed = await freeSeededDivisions("found");
      const flagship = freed.unassignedShips[0]!;
      await create("found", flagship.shipId, { expectedRevision: freed.revision });
      await commit("found", freed.revision);

      const now = await view("found");
      expect(now.revision).toBe(freed.revision + 1);
      expect(now.divisions).toHaveLength(1);
      expect(now.divisions[0]).toMatchObject({
        role: "CORE",
        formation: "LINE_AHEAD",
        commanderVacant: true,
        flagshipShipId: flagship.shipId,
        areaId: flagship.areaId,
      });
      expect(now.divisions[0]!.ships.map((s) => s.shipId)).toEqual([flagship.shipId]);
      expect(now.unassignedShips.some((s) => s.shipId === flagship.shipId)).toBe(false);
    });

    it("refuses a ship that already belongs to a division", async () => {
      registerSession("twice");
      const freed = await freeSeededDivisions("twice");
      const flagship = freed.unassignedShips[0]!.shipId;
      await create("twice", flagship, { expectedRevision: freed.revision });
      await commit("twice", freed.revision);
      const again = await create("twice", flagship, {
        expectedRevision: freed.revision + 1,
        transportRequestId: "req-2",
      });
      expect(again).toMatchObject({
        outcome: "rejected",
        reason: "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      });
    });

    it("adds a ship from the same area at the engine's stated cohesion cost, changes flagship, then dissolves", async () => {
      registerSession("life");
      const freed = await freeSeededDivisions("life");
      const { byArea } = await shipsByArea("life");
      const ships = [...byArea.values()].find((ids) => ids.length >= 2)!;
      const [flagship, second] = [ships[0]!, ships[1]!];

      let rev = freed.revision;
      await create("life", flagship, { expectedRevision: rev });
      await commit("life", rev);
      rev += 1;
      let now = await view("life");
      const divisionId = now.divisions[0]!.divisionId;
      const cohesionBefore = now.divisions[0]!.cohesion;

      const add = await submitDivisionCommand(
        payload(
          "life",
          { type: "AddShipToDivision", divisionId, shipId: second },
          { expectedRevision: rev, transportRequestId: "req-add" },
        ),
      );
      expect(add.outcome).toBe("success");
      await commit("life", rev);
      rev += 1;
      now = await view("life");
      expect(now.divisions[0]!.ships.map((s) => s.shipId)).toEqual([flagship, second]);
      expect(now.divisions[0]!.cohesion).toBeLessThan(cohesionBefore);

      const flag = await submitDivisionCommand(
        payload(
          "life",
          { type: "ChangeDivisionFlagship", divisionId, newFlagshipShipId: second },
          { expectedRevision: rev, transportRequestId: "req-flag" },
        ),
      );
      expect(flag.outcome).toBe("success");
      await commit("life", rev);
      rev += 1;
      now = await view("life");
      expect(now.divisions[0]!.flagshipShipId).toBe(second);

      const dissolve = await submitDivisionCommand(
        payload(
          "life",
          { type: "DissolveDivision", divisionId },
          { expectedRevision: rev, transportRequestId: "req-dissolve" },
        ),
      );
      expect(dissolve.outcome).toBe("success");
      await commit("life", rev);
      now = await view("life");
      expect(now.divisions).toEqual([]);
      expect(now.unassignedShips.map((s) => s.shipId)).toEqual(
        expect.arrayContaining([flagship, second]),
      );
    });

    it("PINS an engine gap: AddShipToDivision does not enforce the same-area rule (the UI must prevent it)", async () => {
      registerSession("cross");
      const freed = await freeSeededDivisions("cross");
      const { byArea } = await shipsByArea("cross");
      const areas = [...byArea.entries()];
      expect(areas.length).toBeGreaterThanOrEqual(2);
      const homeShip = areas[0]![1][0]!;
      const farShip = areas[1]![1][0]!;

      let rev = freed.revision;
      await create("cross", homeShip, { expectedRevision: rev });
      await commit("cross", rev);
      rev += 1;
      const divisionId = (await view("cross")).divisions[0]!.divisionId;

      const add = await submitDivisionCommand(
        payload(
          "cross",
          { type: "AddShipToDivision", divisionId, shipId: farShip },
          { expectedRevision: rev, transportRequestId: "req-far" },
        ),
      );
      expect(add.outcome).toBe("success");
      await commit("cross", rev);
      const now = await view("cross");
      expect(now.divisions[0]!.ships.map((s) => s.shipId)).toEqual([homeShip, farShip]);
    });

    it("reorders a division's ships at the engine's reorder cost, keeping the flagship", async () => {
      registerSession("reorder");
      const freed = await freeSeededDivisions("reorder");
      const { v, byArea } = await shipsByArea("reorder");
      const pair = [...byArea.values()].find((ids) => ids.length >= 2)!;
      const flagship = pair[0]!;
      const second = pair[1]!;
      const third = v.unassignedShips
        .map((s) => s.shipId)
        .find((id) => id !== flagship && id !== second)!;
      expect(third).toBeDefined();

      let rev = freed.revision;
      await create("reorder", flagship, { expectedRevision: rev });
      await commit("reorder", rev);
      rev += 1;
      const divisionId = (await view("reorder")).divisions[0]!.divisionId;

      for (const shipId of [second, third]) {
        const add = await submitDivisionCommand(
          payload(
            "reorder",
            { type: "AddShipToDivision", divisionId, shipId },
            { expectedRevision: rev, transportRequestId: `req-add-${shipId}` },
          ),
        );
        expect(add.outcome).toBe("success");
        await commit("reorder", rev);
        rev += 1;
      }

      const before = await view("reorder");
      expect(before.divisions[0]!.ships.map((s) => s.shipId)).toEqual([flagship, second, third]);
      const cohesionBefore = before.divisions[0]!.cohesion;

      const reorder = await submitDivisionCommand(
        payload(
          "reorder",
          { type: "ReorderDivisionShips", divisionId, shipOrder: [flagship, third, second] },
          { expectedRevision: rev, transportRequestId: "req-reorder" },
        ),
      );
      expect(reorder).toMatchObject({
        outcome: "success",
        value: { bodyType: "ReorderDivisionShips", appliedOnNextTurn: true },
      });
      expect(queued("reorder").some((e) => e.body.type === "ReorderDivisionShips")).toBe(true);

      await commit("reorder", rev);
      const after = await view("reorder");
      expect(after.divisions[0]!.ships.map((s) => s.shipId)).toEqual([flagship, third, second]);
      expect(after.divisions[0]!.flagshipShipId).toBe(flagship);
      expect(after.divisions[0]!.cohesion).toBe(cohesionBefore - 3);
    });
  });
});
