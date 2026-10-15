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
import { clearPendingWorkspacesForTest, pendingEnvelopesForExecution } from "../pendingCommands.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import type { CommandProgram } from "../runtime/commandProgram.js";
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

// One shared runtime for every division program; the services delegate to the
// same in-memory session/queue registries the tests populate directly.
const runtime = ManagedRuntime.make(desktopMainLayer());

/** Runs a command program through the desktop service graph and projects its wire envelope. */
async function runProgram<A>(program: CommandProgram, payload: unknown): Promise<BridgeResult<A>> {
  return projectCommandExit(await runtime.runPromiseExit(program(payload))) as BridgeResult<A>;
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

/**
 * Fleet-organization bridge tests against the real production pack: the engine's
 * own validator decides legality at issue time, the queue holds a real envelope,
 * and only `commitMonth` mutates divisions.
 */
describe("division commands", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-division-"));
  });
  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    clearPendingWorkspacesForTest();
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
    return pendingEnvelopesForExecution(sessionId, state.snapshot).filter((e) =>
      DIVISION_TYPES.has(e.body.type as string),
    );
  }

  /** The player's real unassigned ships, grouped by area (production UK fleets). */
  async function shipsByArea(sessionId: string) {
    const v = await view(sessionId);
    const byArea = new Map<string, string[]>();
    for (const ship of v.unassignedShips) {
      byArea.set(ship.areaId, [...(byArea.get(ship.areaId) ?? []), ship.shipId]);
    }
    return { v, byArea };
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

    it("projects the real production start: no divisions, every UK ship unassigned, engine limits and costs", async () => {
      registerSession("inspect");
      const v = await view("inspect");
      expect(v.revision).toBe(0);
      expect(v.divisions).toEqual([]);
      expect(v.unassignedShips.length).toBeGreaterThanOrEqual(3);
      expect(v.unassignedShips.every((s) => s.name.length > 0 && s.areaName.length > 0)).toBe(true);
      expect(v.roles).toContain("CORE");
      expect(v.formations).toContain("LINE_AHEAD");
      expect(v.maxShips).toBe(5);
      expect(v.penalties.addShip).toEqual({ experience: 5, cohesion: 10 });
    });
  });

  describe("submitDivisionCommand — issue time", () => {
    it("queues a real CreateDivision envelope founded on one flagship, with a deterministic id", async () => {
      registerSession("create");
      const { v } = await shipsByArea("create");
      const flagship = v.unassignedShips[0]!.shipId;
      const result = await create("create", flagship);
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
      expect(body["divisionId"]).toBe(newDivisionId("uk", 0, flagship));
      // The authoritative state is untouched until the month is committed.
      expect(getCampaignSession("create")!.state.snapshot.nations.get("uk")!.divisions).toEqual([]);
    });

    it("replays an identical retry and rejects a different body under the same transportRequestId", async () => {
      registerSession("idem");
      const { v } = await shipsByArea("idem");
      const [first, second] = [v.unassignedShips[0]!.shipId, v.unassignedShips[1]!.shipId];
      const a = await create("idem", first);
      const replay = await create("idem", first);
      expect(replay).toEqual(a);
      expect(queued("idem")).toHaveLength(1);

      const conflict = await create("idem", second);
      expect(conflict).toMatchObject({ outcome: "rejected", reason: "IDEMPOTENCY_CONFLICT" });
      expect(queued("idem")).toHaveLength(1);
    });

    it("rejects a stale revision without queueing", async () => {
      registerSession("stale");
      const { v } = await shipsByArea("stale");
      const result = await create("stale", v.unassignedShips[0]!.shipId, { expectedRevision: 7 });
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
      const { v } = await shipsByArea("found");
      const flagship = v.unassignedShips[0]!;
      await create("found", flagship.shipId);
      await commit("found", 0);

      const now = await view("found");
      expect(now.revision).toBe(1);
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
      const { v } = await shipsByArea("twice");
      const flagship = v.unassignedShips[0]!.shipId;
      await create("twice", flagship);
      await commit("twice", 0);
      const again = await create("twice", flagship, {
        expectedRevision: 1,
        transportRequestId: "req-2",
      });
      expect(again).toMatchObject({
        outcome: "rejected",
        reason: "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      });
    });

    it("adds a ship from the same area at the engine's stated cohesion cost, changes flagship, then dissolves", async () => {
      registerSession("life");
      const { byArea } = await shipsByArea("life");
      const [, ships] = [...byArea.entries()].find(([, ids]) => ids.length >= 2)!.length
        ? ([null, [...byArea.values()].find((ids) => ids.length >= 2)!] as const)
        : [null, []];
      const [flagship, second] = [ships[0]!, ships[1]!];

      await create("life", flagship);
      await commit("life", 0);
      let now = await view("life");
      const divisionId = now.divisions[0]!.divisionId;
      const cohesionBefore = now.divisions[0]!.cohesion;

      const add = await submitDivisionCommand(
        payload(
          "life",
          { type: "AddShipToDivision", divisionId, shipId: second },
          { expectedRevision: 1, transportRequestId: "req-add" },
        ),
      );
      expect(add.outcome).toBe("success");
      await commit("life", 1);
      now = await view("life");
      expect(now.divisions[0]!.ships.map((s) => s.shipId)).toEqual([flagship, second]);
      expect(now.divisions[0]!.cohesion).toBeLessThan(cohesionBefore);

      const flag = await submitDivisionCommand(
        payload(
          "life",
          { type: "ChangeDivisionFlagship", divisionId, newFlagshipShipId: second },
          { expectedRevision: 2, transportRequestId: "req-flag" },
        ),
      );
      expect(flag.outcome).toBe("success");
      await commit("life", 2);
      now = await view("life");
      expect(now.divisions[0]!.flagshipShipId).toBe(second);

      const dissolve = await submitDivisionCommand(
        payload(
          "life",
          { type: "DissolveDivision", divisionId },
          { expectedRevision: 3, transportRequestId: "req-dissolve" },
        ),
      );
      expect(dissolve.outcome).toBe("success");
      await commit("life", 3);
      now = await view("life");
      expect(now.divisions).toEqual([]);
      expect(now.unassignedShips.map((s) => s.shipId)).toEqual(
        expect.arrayContaining([flagship, second]),
      );
    });

    it("PINS an engine gap: AddShipToDivision does not enforce the same-area rule (the UI must prevent it)", async () => {
      registerSession("cross");
      const { byArea } = await shipsByArea("cross");
      const areas = [...byArea.entries()];
      expect(areas.length).toBeGreaterThanOrEqual(2);
      const homeShip = areas[0]![1][0]!;
      const farShip = areas[1]![1][0]!;

      await create("cross", homeShip);
      await commit("cross", 0);
      const divisionId = (await view("cross")).divisions[0]!.divisionId;

      const add = await submitDivisionCommand(
        payload(
          "cross",
          { type: "AddShipToDivision", divisionId, shipId: farShip },
          { expectedRevision: 1, transportRequestId: "req-far" },
        ),
      );
      expect(add.outcome).toBe("success");
      await commit("cross", 1);
      // DESIGN-26 lists DIVISION_LOCATION_CONFLICT, but the engine's add path does not
      // apply it: the division now spans two areas. The Fleet UI therefore offers only
      // same-area ships; if the engine starts enforcing the rule, this test should flip
      // to a rejection (see docs/research/rtw3-parity-engine-roadmap.md).
      const now = await view("cross");
      expect(now.divisions[0]!.ships.map((s) => s.shipId)).toEqual([homeShip, farShip]);
    });

    it("reorders a division's ships at the engine's reorder cost, keeping the flagship", async () => {
      registerSession("reorder");
      const { v, byArea } = await shipsByArea("reorder");
      // At least two ships share an area; the engine does not enforce the
      // same-area rule on AddShipToDivision (pinned above), so a third may come
      // from elsewhere to give the division something to reorder.
      const pair = [...byArea.values()].find((ids) => ids.length >= 2)!;
      const flagship = pair[0]!;
      const second = pair[1]!;
      const third = v.unassignedShips
        .map((s) => s.shipId)
        .find((id) => id !== flagship && id !== second)!;
      expect(third).toBeDefined();

      await create("reorder", flagship);
      await commit("reorder", 0);
      const divisionId = (await view("reorder")).divisions[0]!.divisionId;

      let rev = 1;
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
