import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignSnapshot, CampaignState, WarDeclaration } from "@bluewave/campaign";
import { buildBattleHistory } from "@bluewave/campaign-engine";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  GenerateBattleResult,
  ResolveBattleResult,
  SeedCampaignBattleDrillResult,
} from "../../shared/campaign-command-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import type { CommandProgram } from "../runtime/commandProgram.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import {
  clearBattleSandboxForTest,
  colocateWarSides,
  excludeUndesignedShips,
  generateBattleProgram,
  replayBattleBoundaryProgram,
  resolveBattleProgram,
  resolveTacticalBattleProgram,
  seedCampaignBattleDrillProgram,
} from "./battleSandboxCommands.js";
import { commitMonthProgram } from "./commitMonth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATED_ARTIFACT = resolve(__dirname, "../../../../..", "content", "generated", "1880");

const WAR_ID = "war_uk_france_1880-01";

// One shared runtime for every program; the services delegate to the same
// in-memory session registry the tests populate directly.
const runtime = ManagedRuntime.make(desktopMainLayer());

/** Runs a command program through the desktop service graph and projects its wire envelope. */
async function runProgram<A>(program: CommandProgram, payload: unknown): Promise<BridgeResult<A>> {
  return projectCommandExit(await runtime.runPromiseExit(program(payload))) as BridgeResult<A>;
}

/**
 * The Tactical Sandbox commands are debug-gated (ADR-0057) by the build-time
 * `__BLUEWAVE_DEBUG__` constant. Unit tests run outside the Electron build, so
 * the flag is stubbed on here; the `debug gate` block stubs it off to prove
 * `DEBUG_ONLY`.
 */
function setDebugEnabled(enabled: boolean): void {
  vi.stubGlobal("__BLUEWAVE_DEBUG__", enabled);
}

const generateBattle = (payload: {
  sessionId: string;
  warId?: string;
  areaId?: string;
  strengthScale?: number;
}) => runProgram<GenerateBattleResult>(generateBattleProgram, payload);

const resolveBattle = (payload: { sessionId: string; battleId: string }) =>
  runProgram<ResolveBattleResult>(resolveBattleProgram, payload);

const resolveTacticalBattle = (payload: unknown) =>
  runProgram<never>(resolveTacticalBattleProgram, payload);

const replayBattleBoundary = (payload: { sessionId: string; battleId: string }) =>
  runProgram<never>(replayBattleBoundaryProgram, payload);

const seedCampaignBattleDrill = (payload: { sessionId: string; warId?: string }) =>
  runProgram<SeedCampaignBattleDrillResult>(seedCampaignBattleDrillProgram, payload);

const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<unknown>(commitMonthProgram, payload);

describe("battle sandbox commands (ADR-0057)", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-battle-sandbox-"));
    setDebugEnabled(true);
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    clearBattleSandboxForTest();
    vi.unstubAllGlobals();
  });

  function activeWar(status: WarDeclaration["status"] = "ACTIVE"): WarDeclaration {
    return {
      id: WAR_ID,
      attackerSideId: "side_uk",
      defenderSideId: "side_france",
      attackerSideMembers: ["uk"],
      defenderSideMembers: ["france"],
      attackerWarScore: 0,
      defenderWarScore: 0,
      attackerId: "uk",
      defenderId: "france",
      startDate: "1880-01",
      status,
    };
  }

  function registerSession(
    sessionId: string,
    patch?: (snapshot: CampaignSnapshot) => void,
  ): CampaignState {
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      new DiagnosticCollector(),
    );
    if (!output) throw new Error("production pack failed to compile");
    const snapshot = structuredClone(output.state.snapshot);
    if (patch) patch(snapshot);
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

  const withWar = (snapshot: CampaignSnapshot) => {
    snapshot.wars = { ...snapshot.wars, wars: [activeWar()] };
  };

  /** A session with an ACTIVE UK-France war and one committed month (so strategic weather exists). */
  async function warSessionWithWeather(sessionId: string): Promise<void> {
    registerSession(sessionId, withWar);
    const committed = await commitMonth({
      sessionId,
      expectedRevision: 0,
      transportRequestId: `commit-${sessionId}`,
    });
    expect(committed.outcome).toBe("success");
  }

  async function generated(sessionId: string, extra: { strengthScale?: number } = {}) {
    const result = await generateBattle({ sessionId, warId: WAR_ID, ...extra });
    if (result.outcome !== "success") {
      throw new Error(`generate failed: ${result.outcome} ${JSON.stringify(result)}`);
    }
    return result.value.manifest;
  }

  describe("debug gate (R4)", () => {
    beforeEach(() => setDebugEnabled(false));

    it("rejects every command with DEBUG_ONLY in a non-debug build", async () => {
      registerSession("s1", withWar);
      const results = await Promise.all([
        generateBattle({ sessionId: "s1", warId: WAR_ID }),
        resolveBattle({ sessionId: "s1", battleId: "b" }),
        resolveTacticalBattle({ sessionId: "s1", battleId: "b", turnCount: 1, scriptedOrders: [] }),
        replayBattleBoundary({ sessionId: "s1", battleId: "b" }),
        seedCampaignBattleDrill({ sessionId: "s1" }),
      ]);
      for (const result of results) {
        expect(result).toMatchObject({ outcome: "rejected", reason: "DEBUG_ONLY" });
      }
    });
  });

  describe("generateBattle rejections (R1: never NOT_IMPLEMENTED)", () => {
    it("reports SESSION_NOT_FOUND for an unknown session", async () => {
      expect(await generateBattle({ sessionId: "nope", warId: WAR_ID })).toMatchObject({
        outcome: "error",
        reason: "SESSION_NOT_FOUND",
      });
    });

    it("reports WAR_NOT_FOUND and tells the player how to get a war when there are none", async () => {
      registerSession("s1");
      const result = await generateBattle({ sessionId: "s1", warId: WAR_ID });
      expect(result).toMatchObject({ outcome: "rejected", reason: "WAR_NOT_FOUND" });
      expect(JSON.stringify(result)).toMatch(/declare war/i);
    });

    it("lists the known wars when the requested one does not exist", async () => {
      registerSession("s1", withWar);
      const result = await generateBattle({ sessionId: "s1", warId: "war_other" });
      expect(result).toMatchObject({ outcome: "rejected", reason: "WAR_NOT_FOUND" });
      expect(JSON.stringify(result)).toContain(WAR_ID);
    });

    it("reports WAR_NOT_ACTIVE for a war that has ended", async () => {
      registerSession("s1", (snapshot) => {
        snapshot.wars = {
          ...snapshot.wars,
          wars: [activeWar("ENDED" as WarDeclaration["status"])],
        };
      });
      expect(await generateBattle({ sessionId: "s1", warId: WAR_ID })).toMatchObject({
        outcome: "rejected",
        reason: "WAR_NOT_ACTIVE",
      });
    });

    it("documents the strength-floor finding: with real strengths (scale 1) no battle is eligible", async () => {
      registerSession("s1", withWar);
      const result = await generateBattle({ sessionId: "s1", warId: WAR_ID, strengthScale: 1 });
      expect(result).toMatchObject({ outcome: "rejected", reason: "NO_ELIGIBLE_BATTLE" });
    });

    it("rejects an area the defender has no ships in", async () => {
      registerSession("s1", withWar);
      const result = await generateBattle({
        sessionId: "s1",
        warId: WAR_ID,
        areaId: "africa_cape",
      });
      expect(result).toMatchObject({ outcome: "rejected", reason: "AREA_NOT_DEFENDED" });
    });

    it("rejects an out-of-range strengthScale at the schema boundary", async () => {
      registerSession("s1", withWar);
      expect(
        await generateBattle({ sessionId: "s1", warId: WAR_ID, strengthScale: 0 }),
      ).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
    });
  });

  describe("excludeUndesignedShips", () => {
    it("treats ships with no compiled design as unavailable on a copy and reports them", () => {
      const output = compileProductionCampaignFromArtifact(
        GENERATED_ARTIFACT,
        new AbortController().signal,
        new DiagnosticCollector(),
      );
      if (!output) throw new Error("compile failed");
      // N-2 (tickets 29/30) closed the last production linkage gaps, so inject a
      // design-less ship to exercise the guard.
      const base = output.state.snapshot;
      const uk = base.nations.get("uk")!;
      const target = uk.fleets
        .flatMap((fleet) => fleet.ships)
        .find((ship) => !ship.isUnderConstruction)!;
      const snapshot: CampaignSnapshot = {
        ...base,
        nations: new Map(base.nations).set("uk", {
          ...uk,
          fleets: uk.fleets.map((fleet) => ({
            ...fleet,
            ships: fleet.ships.map((ship) =>
              ship.id === target.id ? { ...ship, designVersionId: "des_absent" } : ship,
            ),
          })),
        }),
      };
      const before = structuredClone(snapshot);
      const result = excludeUndesignedShips(snapshot);
      expect(result.excluded).toContain(target.id);
      expect(snapshot).toEqual(before);
      const ship = result.snapshot.nations
        .get("uk")!
        .fleets.flatMap((f) => f.ships)
        .find((s) => s.id === target.id)!;
      expect(ship.isUnderConstruction).toBe(true);
    });
  });

  describe("colocateWarSides", () => {
    function snapshotOf(): CampaignSnapshot {
      const output = compileProductionCampaignFromArtifact(
        GENERATED_ARTIFACT,
        new AbortController().signal,
        new DiagnosticCollector(),
      );
      if (!output) throw new Error("compile failed");
      return output.state.snapshot;
    }

    it("moves completed attacker ships into the defender's area without mutating the input", () => {
      const snapshot = snapshotOf();
      const before = structuredClone(snapshot);
      const result = colocateWarSides(snapshot, "uk", "france", undefined);
      if ("error" in result) throw new Error(result.error);
      expect(result.moved).toBe(true);
      expect(snapshot).toEqual(before);
      const moved = result.snapshot.nations.get("uk")!;
      for (const fleet of moved.fleets) {
        expect(fleet.locationAreaId).toBe(result.areaId);
        for (const ship of fleet.ships) {
          if (!ship.isUnderConstruction) expect(ship.locationAreaId).toBe(result.areaId);
        }
      }
      // Ships still under construction are not teleported.
      const original = snapshot.nations.get("uk")!;
      const building = original.fleets.flatMap((f) => f.ships).filter((s) => s.isUnderConstruction);
      for (const ship of building) {
        const after = moved.fleets.flatMap((f) => f.ships).find((s) => s.id === ship.id)!;
        expect(after.locationAreaId).toBe(ship.locationAreaId);
      }
    });

    it("returns the same snapshot untouched when the sides already share an area", () => {
      const snapshot = snapshotOf();
      const first = colocateWarSides(snapshot, "uk", "france", undefined);
      if ("error" in first) throw new Error(first.error);
      const again = colocateWarSides(first.snapshot, "uk", "france", undefined);
      if ("error" in again) throw new Error(again.error);
      expect(again.moved).toBe(false);
      expect(again.snapshot).toBe(first.snapshot);
    });

    it("errors when a side has no completed ships", () => {
      expect(colocateWarSides(snapshotOf(), "uk", "no_such_nation", undefined)).toMatchObject({
        error: "NO_DEFENDER_FORCES",
      });
    });
  });

  describe("generateBattle (R2, R3)", () => {
    it("produces a manifest for a declared war on a temporary scenario", async () => {
      await warSessionWithWeather("s1");
      const result = await generateBattle({ sessionId: "s1", warId: WAR_ID });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      const { manifest } = result.value;
      expect(manifest.warId).toBe(WAR_ID);
      expect(manifest.sides.map((s) => s.nationId).sort()).toEqual(["france", "uk"]);
      expect(manifest.sides.every((s) => s.participants.length > 0)).toBe(true);
      expect(manifest.manifestHash).toMatch(/^[0-9a-f]{64}$/);
      // The player is told the scenario is synthetic.
      expect(result.diagnostics.join(" ")).toMatch(/temporary copy/);
      expect(result.diagnostics.join(" ")).toMatch(/scaled x100/);
    });

    it("is deterministic: the same request returns the same manifest hash (R2)", async () => {
      await warSessionWithWeather("s1");
      const a = await generated("s1");
      const b = await generated("s1");
      expect(a.manifestHash).toBe(b.manifestHash);
      expect(a.battleId).toBe(b.battleId);
    });

    it("never changes the campaign snapshot, its hash or its saves (R3)", async () => {
      await warSessionWithWeather("s1");
      const record = getCampaignSession("s1")!;
      const snapshotBefore = structuredClone(record.state.snapshot);
      const stateBefore = record.state;
      const manifest = await generated("s1");
      await resolveBattle({ sessionId: "s1", battleId: manifest.battleId });
      const after = getCampaignSession("s1")!;
      expect(after.state).toBe(stateBefore);
      expect(after.state.snapshot).toEqual(snapshotBefore);
    });
  });

  describe("generateBattle without an explicit war id (arena auto-selection)", () => {
    it("auto-selects the player's active war when no war id is given", async () => {
      await warSessionWithWeather("s1");
      const result = await generateBattle({ sessionId: "s1" });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      expect(result.value.manifest.warId).toBe(WAR_ID);
    });

    it("picks the lowest war id deterministically when several are active", async () => {
      registerSession("s1", (snapshot) => {
        snapshot.wars = {
          ...snapshot.wars,
          wars: [
            { ...activeWar(), id: "war_uk_france_1880-02" },
            { ...activeWar(), id: "war_uk_france_1880-01" },
          ],
        };
      });
      const committed = await commitMonth({
        sessionId: "s1",
        expectedRevision: 0,
        transportRequestId: "commit-auto",
      });
      expect(committed.outcome).toBe("success");

      const result = await generateBattle({ sessionId: "s1" });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      expect(result.value.manifest.warId).toBe("war_uk_france_1880-01");
    });

    it("reports WAR_NOT_FOUND with guidance when the player has no active war", async () => {
      registerSession("s1", (snapshot) => {
        snapshot.wars = { ...snapshot.wars, wars: [] };
      });
      const result = await generateBattle({ sessionId: "s1" });
      expect(result).toMatchObject({ outcome: "rejected", reason: "WAR_NOT_FOUND" });
    });
  });

  describe("resolveBattle (R5)", () => {
    it("requires a generated battle", async () => {
      await warSessionWithWeather("s1");
      expect(await resolveBattle({ sessionId: "s1", battleId: "battle_x" })).toMatchObject({
        outcome: "rejected",
        reason: "BATTLE_NOT_GENERATED",
      });
    });

    it("explains that weather is missing before any month has been advanced", async () => {
      registerSession("s1", withWar);
      const manifest = await generated("s1");
      const result = await resolveBattle({ sessionId: "s1", battleId: manifest.battleId });
      expect(result).toMatchObject({ outcome: "rejected", reason: "NO_STRATEGIC_WEATHER" });
      expect(JSON.stringify(result)).toMatch(/advance a month/);
    });

    it("auto-resolves a generated battle into a partitioned, deterministic result", async () => {
      await warSessionWithWeather("s1");
      const manifest = await generated("s1");
      const request = { sessionId: "s1", battleId: manifest.battleId };
      const first = await resolveBattle(request);
      expect(first.outcome).toBe("success");
      if (first.outcome !== "success") return;
      const { resolution } = first.value;
      expect(resolution.battleId).toBe(manifest.battleId);
      expect([null, "uk", "france"]).toContain(resolution.missionOutcome.winner);
      expect(resolution.missionOutcome.outcomeKind.length).toBeGreaterThan(0);
      // Every participating ship is reported exactly once, survived or sunk.
      const reported = [...resolution.attacker.ships, ...resolution.defender.ships].map(
        (s) => s.shipId,
      );
      const participants = manifest.sides.flatMap((side) => side.participants.map((p) => p.shipId));
      expect([...reported].sort()).toEqual([...participants].sort());
      expect(new Set(reported).size).toBe(reported.length);
      for (const ship of [...resolution.attacker.ships, ...resolution.defender.ships]) {
        expect(["survived", "sunk"]).toContain(ship.outcome);
      }
      // No campaign state is applied, and the result says so.
      expect(resolution.warScoreChange).toBe(0);
      expect(first.diagnostics.join(" ")).toMatch(/no campaign state was changed/);

      const second = await resolveBattle(request);
      expect(second).toEqual(first);
    });
  });

  describe("tactical commands without an orchestrator", () => {
    it("rejects scripted tactical resolution and boundary replay honestly (not NOT_IMPLEMENTED)", async () => {
      expect(
        await resolveTacticalBattle({
          sessionId: "s1",
          battleId: "b",
          turnCount: 1,
          scriptedOrders: [],
        }),
      ).toMatchObject({ outcome: "rejected", reason: "TACTICAL_RESOLUTION_UNAVAILABLE" });
      expect(await replayBattleBoundary({ sessionId: "s1", battleId: "b" })).toMatchObject({
        outcome: "rejected",
        reason: "BOUNDARY_REPLAY_UNAVAILABLE",
      });
    });
  });

  describe("seedCampaignBattleDrill (desktop E2E acceptance slice)", () => {
    it("rejects DEBUG_ONLY in a non-debug build", async () => {
      setDebugEnabled(false);
      registerSession("s1", withWar);
      expect(await seedCampaignBattleDrill({ sessionId: "s1" })).toMatchObject({
        outcome: "rejected",
        reason: "DEBUG_ONLY",
      });
    });

    it("stages the LIVE session so the next real month generates and resolves a battle", async () => {
      // A committed month (turn 1) gives the war committed strategic weather.
      await warSessionWithWeather("s1");
      expect(getCampaignSession("s1")!.state.snapshot.wars.battles).toHaveLength(0);

      const drilled = await seedCampaignBattleDrill({ sessionId: "s1" });
      expect(drilled.outcome).toBe("success");
      if (drilled.outcome !== "success") return;
      expect(drilled.value.warId).toBe(WAR_ID);
      expect(drilled.value.strengthScale).toBeGreaterThan(1);

      // The drill staged the snapshot but did NOT inject a battle.
      const staged = getCampaignSession("s1")!;
      expect(Number(staged.state.snapshot.turnNumber)).toBe(1);
      expect(staged.state.snapshot.wars.battles).toHaveLength(0);

      // The real month phases (battle_generation + battle_resolution) run here.
      const committed = await commitMonth({
        sessionId: "s1",
        expectedRevision: 1,
        transportRequestId: "drill-commit",
      });
      expect(committed.outcome).toBe("success");

      const after = getCampaignSession("s1")!;
      const resolved = after.state.snapshot.wars.battles.filter((b) => b.phase === "resolved");
      expect(resolved.length).toBeGreaterThanOrEqual(1);
      const history = buildBattleHistory(after.state.snapshot, "uk");
      expect(history.battles.some((b) => b.involvesPlayer)).toBe(true);
    });
  });
});
