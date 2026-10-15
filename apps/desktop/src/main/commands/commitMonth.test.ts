import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BattleInstance,
  CampaignSlot,
  CampaignSnapshot,
  CampaignState,
} from "@bluewave/campaign";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION, SaveStore } from "@bluewave/persistence";
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
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import { mapBattleOutcome } from "./commitMonth/battleOutcomes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

// The commit program runs through the desktop service graph; the services
// delegate to the same in-memory session registry the tests populate directly.
const runtime = ManagedRuntime.make(desktopMainLayer());

/** Runs the commit program and projects its wire envelope. */
async function commitMonth(payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}): Promise<BridgeResult<CommitMonthResponse>> {
  return projectCommandExit(
    await runtime.runPromiseExit(commitMonthProgram(payload)),
  ) as BridgeResult<CommitMonthResponse>;
}

describe("commitMonth", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-commit-month-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
  });

  it("returns SESSION_NOT_FOUND for an unregistered session", async () => {
    const result = await commitMonth({
      sessionId: "no-such-session",
      expectedRevision: 0,
      transportRequestId: "req-0",
    });
    expect(result.outcome).toBe("error");
    if (result.outcome !== "error") return;
    expect(result.reason).toBe("SESSION_NOT_FOUND");
  });

  describe("against the real production pack", () => {
    function registerProductionSession(sessionId: string, saveDir: string): CampaignState {
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
        playerSlotId: "uk",
        campaignSeed: "a".repeat(32),
        month: { month: 1, year: 1880 },
        state,
      });
      return state;
    }

    it("produces a real MonthReport (opening/closing treasury, maintenance, construction spending) — not placeholder data", async () => {
      const saveDir = resolve(saveRoot, "save-1");
      const initialState = registerProductionSession("session-report", saveDir);
      const ukBefore = initialState.snapshot.nations.get("uk")!;

      const result = await commitMonth({
        sessionId: "session-report",
        expectedRevision: 0,
        transportRequestId: "req-1",
      });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const { report, financialLedger } = result.value;
      expect(report.month).toEqual({ month: 1, year: 1880 });
      expect(report.openingTreasury).toBe(Number(ukBefore.treasury));
      // uk has real ships in the production pack, so real maintenance is owed.
      expect(report.maintenanceCost).toBeGreaterThan(0);
      expect(report.closingTreasury).not.toBe(report.openingTreasury);

      expect(financialLedger.length).toBeGreaterThan(0);
      expect(financialLedger.some((e) => e.phase === "maintenance")).toBe(true);
      // Cross-check the report figure against the raw ledger it was
      // derived from, rather than a hardcoded placeholder number.
      const maintenanceFromLedger = financialLedger
        .filter((e) => e.phase === "maintenance")
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);
      expect(report.maintenanceCost).toBe(maintenanceFromLedger);
    });

    it("reflects the post-commit turn number and month in closingSnapshot and the session registry", async () => {
      const saveDir = resolve(saveRoot, "save-2");
      registerProductionSession("session-revision", saveDir);

      const result = await commitMonth({
        sessionId: "session-revision",
        expectedRevision: 0,
        transportRequestId: "req-1",
      });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      expect(result.value.closingSnapshot.revision).toBe(1);
      expect(result.value.closingSnapshot.month).toEqual({ month: 2, year: 1880 });

      const updated = getCampaignSession("session-revision");
      expect(updated).toBeDefined();
      expect(Number(updated!.state.snapshot.turnNumber)).toBe(1);
      expect(updated!.month).toEqual({ month: 2, year: 1880 });
      expect(Number(updated!.state.snapshot.nations.get("uk")!.treasury)).toBe(
        result.value.report.closingTreasury,
      );
    });

    it("persists the updated state — round-trips through save/load", async () => {
      const saveDir = resolve(saveRoot, "save-3");
      registerProductionSession("session-persist", saveDir);

      const result = await commitMonth({
        sessionId: "session-persist",
        expectedRevision: 0,
        transportRequestId: "req-1",
      });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const diagnostics = new DiagnosticCollector();
      const loaded = new SaveStore().load(saveDir, diagnostics);
      expect(diagnostics.hasErrors).toBe(false);
      expect(loaded).not.toBeNull();
      if (!loaded) return;

      expect(Number(loaded.snapshot.turnNumber)).toBe(1);
      const ukLoaded = loaded.snapshot.nations.get("uk")!;
      expect(Number(ukLoaded.treasury)).toBe(result.value.report.closingTreasury);
    });

    it("rejects a stale expectedRevision without mutating the session or writing a new save", async () => {
      const saveDir = resolve(saveRoot, "save-4");
      registerProductionSession("session-stale", saveDir);

      const result = await commitMonth({
        sessionId: "session-stale",
        expectedRevision: 5,
        transportRequestId: "req-1",
      });
      expect(result.outcome).toBe("rejected");
      if (result.outcome !== "rejected") return;
      expect(result.reason).toBe("REVISION_MISMATCH");
      expect(result.currentRevision).toBe(0);

      const stillThere = getCampaignSession("session-stale");
      expect(Number(stillThere!.state.snapshot.turnNumber)).toBe(0);
    });

    it("advancing twice keeps expectedRevision correct and advances the turn/month monotonically", async () => {
      const saveDir = resolve(saveRoot, "save-5");
      registerProductionSession("session-twice", saveDir);

      const first = await commitMonth({
        sessionId: "session-twice",
        expectedRevision: 0,
        transportRequestId: "req-1",
      });
      expect(first.outcome).toBe("success");

      const second = await commitMonth({
        sessionId: "session-twice",
        expectedRevision: 1,
        transportRequestId: "req-2",
      });
      expect(second.outcome).toBe("success");
      if (second.outcome !== "success") return;
      expect(second.value.closingSnapshot.revision).toBe(2);
      expect(second.value.closingSnapshot.month).toEqual({ month: 3, year: 1880 });
      expect(second.value.report.month).toEqual({ month: 2, year: 1880 });
    });

    it("a month with no battles returns an EMPTY battleOutcomes and unchanged activeWars", async () => {
      const saveDir = resolve(saveRoot, "save-nobattle");
      registerProductionSession("session-nobattle", saveDir);

      const result = await commitMonth({
        sessionId: "session-nobattle",
        expectedRevision: 0,
        transportRequestId: "req-1",
      });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      // The production pack compiles with zero active wars at turn 0, so no
      // month ever emits a BattleResolved event here.
      expect(result.value.domainEvents.some((e) => e.kind === "BattleResolved")).toBe(false);
      // Byte-identical to the pre-INC-2 seed (`battleOutcomes: []`).
      expect(result.value.closingSnapshot.battleOutcomes).toEqual([]);
      // activeWars behaviour is preserved (still lists every non-ENDED war).
      const updated = getCampaignSession("session-nobattle")!;
      // AC-3 "byte-identical": the persisted snapshot envelope + raw hash are
      // the deterministic baseline for the production pack at turn 1 — adding
      // `battleOutcomes` changed only the bridge response, never these
      // authoritative hashes. Pinned so any accidental engine/snapshot change
      // that should not happen here is caught as a hash drift.
      expect(updated.state.envelope).toEqual({
        algorithm: "sha256",
        artifactKind: "campaign-snapshot",
        compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
        bodyHash: "501472dccac73b5352a0b56b871c74ed6e89a237db45178e21c14bcbf5a57feb",
        bodyLength: 87677,
      });
      expect(updated.state.rawHash).toBe(
        "f8018aab8f3e0ec111400cf19ed3fad0c916c48ae8dbedd79c958cb9223d94a7",
      );
      const expectedActiveWars = updated.state.snapshot.wars.wars.filter(
        (w) => w.status !== "ENDED",
      );
      expect(result.value.closingSnapshot.activeWars).toEqual(expectedActiveWars);
    });
  });

  describe("battle auto-resolution (synthetic fixture)", () => {
    // The production pack's `buildWarState()` always compiles with zero
    // active wars at turn 0 (`packages/campaign/src/compiler.ts:565`), so a
    // real compile->commitMonth loop never exercises `MonthExecutor`'s
    // battle-generation/resolution phases. This mirrors
    // `packages/phase-engine/test/battle-generation-phase.test.ts`'s
    // hand-authored two-nation, co-located, at-war fixture to prove the
    // integration for real rather than leaving it merely plumbed.
    function makeNation(
      id: string,
      isPlayable: boolean,
      ships: Array<{ id: string; loc: string }>,
    ) {
      return {
        id,
        name: id,
        tag: id,
        treasury: SafeInt(10000),
        income: SafeInt(0),
        expenses: SafeInt(0),
        baseResources: SafeInt(0),
        navalAppropriationRateBp: SafeInt(2000),
        maintenanceCost: SafeInt(0),
        fleets: [
          {
            id: `fleet-${id}`,
            nationId: id,
            name: `${id} Fleet`,
            locationAreaId: ships[0]!.loc,
            ships: ships.map((s) => ({
              id: s.id,
              name: s.id,
              classId: "battleship",
              nationId: id,
              locationAreaId: s.loc,
              // B-6 INC-2 tactical auto-resolution promotes ships via their
              // compiled design (matching `battle-fixtures.ts`); an empty
              // designVersionId throws TACTICAL_UNIT_PROMOTION_INVALID and
              // falls back to the legacy path, which the test does not want.
              designVersionId: `dv-${s.id}`,
              hitPoints: SafeInt(100),
              maxHitPoints: SafeInt(100),
              speed: SafeInt(30),
              firepower: SafeInt(200),
              armor: SafeInt(10),
              isUnderConstruction: false,
              constructionProgress: SafeInt(0),
              constructionTotalWork: SafeInt(0),
            })),
          },
        ],
        divisions: [],
        research: {
          nationId: id,
          technologies: [],
          fieldPriorities: {},
          researchBudget: SafeInt(0),
          activeCandidates: new Map(),
          discoveredTechs: [],
        },
        constructionProjects: [],
        isPlayable,
        isAI: !isPlayable,
      };
    }

    function makeWarSnapshot(): CampaignSnapshot {
      const nations = new Map();
      nations.set(
        "GBR",
        makeNation("GBR", true, [
          { id: "g1", loc: "a-1" },
          { id: "g2", loc: "a-1" },
        ]),
      );
      nations.set(
        "FRA",
        makeNation("FRA", false, [
          { id: "f1", loc: "a-1" },
          { id: "f2", loc: "a-1" },
        ]),
      );
      const slot: CampaignSlot = { nationId: "GBR", type: "playable" };
      const UMS_PER_KNOT = 514_444;
      // Compiled designs for every promoted ship so the B-6 INC-2 tactical
      // auto-resolution path succeeds (mirrors `battle-fixtures.ts`'s
      // `makeDesign`); without these, promotion throws
      // TACTICAL_UNIT_PROMOTION_INVALID and the battle falls back to the
      // legacy strength path instead of exercising the tactical engine.
      const designs = new Map(
        ["g1", "g2", "f1", "f2"].map((shipId) => [
          `dv-${shipId}`,
          {
            designVersionId: `dv-${shipId}`,
            designFamilyId: `dv-${shipId}-family`,
            className: `Class dv-${shipId}`,
            nationId: shipId.startsWith("g") ? "GBR" : "FRA",
            hullType: "battleship",
            normalizedDisplacementKg: SafeInt(30_000_000),
            normalizedSpeedUms: SafeInt(Math.floor(30 * UMS_PER_KNOT)),
            normalizedArmorUm: SafeInt(152_400),
            hitPoints: SafeInt(100),
            mainGunsCaliber: SafeInt(343_000),
            mainGunsCount: SafeInt(10),
            machineryType: "steam_triple_expansion",
            crewComplement: SafeInt(1_000),
            contentVersion: "fixture_v1",
            compiledHash: `compiled-dv-${shipId}`,
          } as import("@bluewave/campaign").CompiledDesignVersion,
        ]),
      );
      return {
        version: "0.1.0",
        turnNumber: SafeInt(0),
        campaignId: "commit-month-battle-fixture",
        startYear: 1880,
        startMonth: 1,
        strategicWeather: [],
        slots: [slot],
        // `weather_generation` (B-6 INC-1) commits strategic weather only for
        // areas present in `world.areas`; the battle's co-located area must be
        // listed or the auto-resolution fail-closed guard trips.
        world: { areas: [{ id: "a-1", name: "a-1", type: "sea" }], routes: [], ports: [] },
        nations,
        wars: {
          wars: [
            {
              id: "war_1",
              attackerSideId: "side_a",
              defenderSideId: "side_d",
              attackerSideMembers: ["GBR"],
              defenderSideMembers: ["FRA"],
              attackerWarScore: 0,
              defenderWarScore: 0,
              attackerId: "GBR",
              defenderId: "FRA",
              startDate: "1880-01",
              status: "ACTIVE",
            },
          ],
          battles: [],
          participantMemberships: [],
          blockadeState: [],
          battleManifests: [],
        },
        politics: { relations: [], shells: {} },
        intelligence: { shells: {} },
        designs,
        designFamilies: new Map(),
        rulesetVersion: "1.0",
        compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
      };
    }

    // Seed whose auto-resolved battle sinks a loser ship before the ADR-0073
    // withdrawal threshold is reached (the default seed now ends by break-off).
    const DECISIVE_SEED = "decisive-04-xxxxxxxxxxxxxxxxxxxx";

    function registerWarSession(
      sessionId: string,
      saveDir: string,
      campaignSeed = "b".repeat(32),
    ): CampaignSnapshot {
      const snapshot = makeWarSnapshot();
      const envelope = createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot);
      const state = toSaveableState({ snapshot, envelope, rawHash: "" });
      new SaveStore().save(state, saveDir);
      registerCampaignSession({
        sessionId,
        saveDir,
        playerSlotId: "GBR",
        campaignSeed,
        month: { month: 1, year: 1880 },
        state,
      });
      return snapshot;
    }

    it("auto-resolves a triggered battle inline — the month completes without any pending-battle state", async () => {
      const saveDir = resolve(saveRoot, "save-war");
      registerWarSession("session-war", saveDir);

      const result = await commitMonth({
        sessionId: "session-war",
        expectedRevision: 0,
        transportRequestId: "req-1",
      });

      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      // The war is still reported (not silently dropped) and the month
      // completed in one shot — nothing here waits for a separate
      // generateBattle/resolveBattle/resolveTacticalBattle round-trip.
      expect(result.value.closingSnapshot.activeWars.length).toBeGreaterThan(0);

      const updated = getCampaignSession("session-war");
      expect(updated).toBeDefined();
      const battles = updated!.state.snapshot.wars.battles;
      expect(battles.length).toBeGreaterThan(0);
      // No battle is left "pending"/"resolving" — every generated battle was
      // resolved within this single commitMonth call.
      expect(battles.every((b) => b.phase === "resolved")).toBe(true);

      // The resolution actually changed something authoritative: war score
      // moved and/or a ship took damage/was lost — not a no-op stub.
      const war = updated!.state.snapshot.wars.wars.find((w) => w.id === "war_1")!;
      const scoreChanged = war.attackerWarScore !== 0 || war.defenderWarScore !== 0;
      expect(scoreChanged).toBe(true);
    });

    it("populates closingSnapshot.battleOutcomes accurately from the engine's resolved battles (INC-2)", async () => {
      const saveDir = resolve(saveRoot, "save-war-outcomes");
      const preSnapshot = registerWarSession("session-war-outcomes", saveDir);

      const result = await commitMonth({
        sessionId: "session-war-outcomes",
        expectedRevision: 0,
        transportRequestId: "req-1",
      });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const postSnapshot = getCampaignSession("session-war-outcomes")!.state.snapshot;
      const resolved = postSnapshot.wars.battles.filter(
        (b) => b.phase === "resolved" && b.result !== undefined,
      );
      // The war fixture co-locates two navies, so at least one battle resolves.
      expect(resolved.length).toBeGreaterThan(0);
      // The INDEPENDENT oracle (engineAppliedWarScoreDelta) reads the whole-war
      // pre→post delta, which only equals ONE battle's magnitude. So this
      // assertion is valid only when the fixture resolves at most one battle per
      // (attacker, defender) war pair — enforce that precondition rather than
      // assume it (ADR-0028 §Consequences multi-battle cascade residual).
      const resolvedKeys = resolved.map((b) => `${b.attackerId}|${b.defenderId}`);
      expect(new Set(resolvedKeys).size).toBe(resolvedKeys.length);

      // One accurate flat BattleOutcome per resolved battle this month.
      expect(result.value.closingSnapshot.battleOutcomes).toHaveLength(resolved.length);
      for (const battle of resolved) {
        const outcome = result.value.closingSnapshot.battleOutcomes.find(
          (o) => o.battleId === battle.id,
        );
        expect(outcome).toBeDefined();
        if (!outcome) continue;

        // Straight engine copies — sides, winner/loser, losses, explanation.
        expect(outcome.areaId).toBe(battle.areaId);
        expect(outcome.attackerId).toBe(battle.attackerId);
        expect(outcome.defenderId).toBe(battle.defenderId);
        expect(outcome.winnerId).toBe(battle.result!.winnerId);
        expect(outcome.loserId).toBe(battle.result!.loserId);
        expect(outcome.attackerLosses).toEqual([...battle.result!.attackerLosses]);
        expect(outcome.defenderLosses).toEqual([...battle.result!.defenderLosses]);
        expect(outcome.explanation).toEqual([...battle.result!.explanation]);

        // INDEPENDENT oracle — NOT a copy of the bridge formula. The engine's
        // `applyBattleResult` (month.ts:1510-1552) literally ADDED a magnitude
        // to the winning war's side score and subtracted it from the losing
        // side's score on the snapshot. For a single decided battle with no
        // ±100 clamping, that pre→post change in the winning war's
        // `attackerWarScore`/`defenderWarScore` IS the delta the bridge must
        // surface. Read the actual war for this battleid from the pre vs post
        // snapshots and assert the bridge re-derives exactly that.
        expect(outcome.warScoreDelta).toBe(
          engineAppliedWarScoreDelta(battle, preSnapshot, postSnapshot),
        );
      }
    });

    it("pins the decisive threshold: a battle that sinks a loser ship yields warScoreDelta 10 (lossFraction >= 0.5)", async () => {
      const saveDir = resolve(saveRoot, "save-war-decisive");
      const preSnapshot = registerWarSession("session-war-decisive", saveDir, DECISIVE_SEED);

      const result = await commitMonth({
        sessionId: "session-war-decisive",
        expectedRevision: 0,
        transportRequestId: "req-1",
      });
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const postSnapshot = getCampaignSession("session-war-decisive")!.state.snapshot;
      const resolved = postSnapshot.wars.battles.filter(
        (b) => b.phase === "resolved" && b.result !== undefined,
      );
      expect(resolved.length).toBe(1);
      const battle = resolved[0]!;
      const outcome = result.value.closingSnapshot.battleOutcomes.find(
        (o) => o.battleId === battle.id,
      );
      expect(outcome).toBeDefined();
      if (!outcome) return;

      // ≥1 loser ship genuinely sank this month (decisive boundary).
      const loserIsAttacker = battle.result!.loserId === battle.attackerId;
      const loserLosses = loserIsAttacker
        ? battle.result!.attackerLosses
        : battle.result!.defenderLosses;
      expect(loserLosses.length).toBeGreaterThan(0);

      // The engine wrote a decisive victory (±10) for this battle...
      expect(engineAppliedWarScoreDelta(battle, preSnapshot, postSnapshot)).toBe(10);
      // ...and the bridge re-derives the SAME decisive magnitude OFF the
      // pre-battle snapshot (the ships sunk this month still counted at full
      // HP), not a recompute over the post-battle snapshot.
      expect(outcome.warScoreDelta).toBe(10);
    });
  });

  /**
   * INDEPENDENT oracle (INC-2 finding 2): the war-score magnitude the engine
   * ACTUALLY applied, read solely from the engine's observable output — the
   * winning war's `attackerWarScore`/`defenderWarScore` pre → post change
   * (could not be written by a copy of the bridge's loss-fraction formula).
   * `applyBattleResult` (month.ts:1510-1552, no-clamp case) adds `+magnitude`
   * to one side and `-magnitude` to the other, so the max absolute side change
   * equals the applied magnitude. Applies to a single decided battle with war
   * scores safely inside [0,100]; non-decided battles contribute 0.
   */
  function engineAppliedWarScoreDelta(
    battle: BattleInstance,
    preSnapshot: CampaignSnapshot,
    postSnapshot: CampaignSnapshot,
  ): number {
    const result = battle.result!;
    if (result.winnerId === null || result.loserId === null) return 0;
    const preWar = preSnapshot.wars.wars.find(
      (w) => w.attackerId === battle.attackerId && w.defenderId === battle.defenderId,
    );
    const postWar = postSnapshot.wars.wars.find(
      (w) => w.attackerId === battle.attackerId && w.defenderId === battle.defenderId,
    );
    if (!preWar || !postWar) return 0;
    const attackerDelta = Math.abs(postWar.attackerWarScore - preWar.attackerWarScore);
    const defenderDelta = Math.abs(postWar.defenderWarScore - preWar.defenderWarScore);
    return Math.max(attackerDelta, defenderDelta);
  }
});

// Focused unit tests for `mapBattleOutcome`'s PRE-battle-snapshot basis (the
// HIGH finding). These hand-build a decided battle whose losing side, counted
// OFF the pre-month snapshot (sunk ship still present, survivor at full HP),
// crosses the DECISIVE threshold — while the SAME battle counted off the
// post-month snapshot (sunk ship removed, survivor's HP reduced) would fall
// into MAJOR. The engine (`applyBattleResult`, month.ts:1510-1552) computed the
// class off the pre-battle snapshot, so the correct bridge value is the
// decisive ±10. A post-snapshot re-derivation would fabricate a lower ±5, and
// these assertions FAIL against such a regression.
describe("mapBattleOutcome (pre-battle-snapshot war-score re-derivation, INC-2 finding 1)", () => {
  function makeNation(
    id: string,
    fleetId: string,
    ships: Array<{ id: string; hitPoints: number }>,
  ): import("@bluewave/campaign").NationState {
    return {
      id,
      name: id,
      tag: id,
      treasury: SafeInt(0),
      income: SafeInt(0),
      expenses: SafeInt(0),
      baseResources: SafeInt(0),
      navalAppropriationRateBp: SafeInt(0),
      maintenanceCost: SafeInt(0),
      fleets: [
        {
          id: fleetId,
          nationId: id,
          name: `${id} Fleet`,
          locationAreaId: "a-1",
          ships: ships.map((s) => ({
            id: s.id,
            name: s.id,
            classId: "battleship",
            nationId: id,
            locationAreaId: "a-1",
            designVersionId: `dv-${s.id}`,
            hitPoints: SafeInt(s.hitPoints),
            maxHitPoints: SafeInt(s.hitPoints),
            speed: SafeInt(30),
            firepower: SafeInt(200),
            armor: SafeInt(10),
            isUnderConstruction: false,
            constructionProgress: SafeInt(0),
            constructionTotalWork: SafeInt(0),
          })),
        },
      ],
      divisions: [],
      research: {
        nationId: id,
        technologies: [],
        fieldPriorities: {},
        researchBudget: SafeInt(0),
        activeCandidates: new Map(),
        discoveredTechs: [],
      },
      constructionProjects: [],
      isPlayable: id === "GBR",
      isAI: id !== "GBR",
    } as import("@bluewave/campaign").NationState;
  }

  function makeSnapshot(
    nations: Map<string, import("@bluewave/campaign").NationState>,
    attackerWarScore: number,
    defenderWarScore: number,
  ): CampaignSnapshot {
    return {
      version: "0.1.0",
      turnNumber: SafeInt(0),
      campaignId: "map-outcome-unit",
      startYear: 1880,
      startMonth: 1,
      strategicWeather: [],
      slots: [],
      world: { areas: [{ id: "a-1", name: "a-1", type: "sea" }], routes: [], ports: [] },
      nations,
      wars: {
        wars: [
          {
            id: "war_1",
            attackerSideId: "side_a",
            defenderSideId: "side_d",
            attackerSideMembers: ["GBR"],
            defenderSideMembers: ["FRA"],
            attackerWarScore,
            defenderWarScore,
            attackerId: "GBR",
            defenderId: "FRA",
            startDate: "1880-01",
            status: "ACTIVE",
          },
        ],
        battles: [],
        participantMemberships: [],
        blockadeState: [],
        battleManifests: [],
      },
      politics: { relations: [], shells: {} },
      intelligence: { shells: {} },
      designs: new Map(),
      designFamilies: new Map(),
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    } as CampaignSnapshot;
  }

  function makeBattle(): BattleInstance {
    return {
      id: "b1",
      phase: "resolved",
      attackerId: "GBR",
      defenderId: "FRA",
      areaId: "a-1",
      attackerFleetIds: ["fleet-GBR"],
      defenderFleetIds: ["fleet-FRA"],
      result: {
        winnerId: "FRA",
        loserId: "GBR",
        attackerLosses: ["g2"],
        defenderLosses: [],
        damageReport: { g1: SafeInt(30), g2: SafeInt(100) },
        explanation: [],
      },
    } as BattleInstance;
  }

  it("re-derives the engine's ±10 DECISIVE class off the PRE-battle snapshot (sunk ship + survivors at full HP)", () => {
    // PRE: the losing attacker (GBR) has g1(100 HP) + g2(100 HP) intact.
    const preNations = new Map<string, import("@bluewave/campaign").NationState>();
    preNations.set(
      "GBR",
      makeNation("GBR", "fleet-GBR", [
        { id: "g1", hitPoints: 100 },
        { id: "g2", hitPoints: 100 },
      ]),
    );
    preNations.set("FRA", makeNation("FRA", "fleet-FRA", [{ id: "f1", hitPoints: 100 }]));
    const pre = makeSnapshot(preNations, 0, 0);

    // POST: the engine's consequences removed the sunk g2 and reduced g1 to
    // 70 HP; the war score already moved -10/+10 (the engine applied DECISIVE).
    const postNations = new Map<string, import("@bluewave/campaign").NationState>();
    postNations.set("GBR", makeNation("GBR", "fleet-GBR", [{ id: "g1", hitPoints: 70 }]));
    postNations.set("FRA", makeNation("FRA", "fleet-FRA", [{ id: "f1", hitPoints: 80 }]));
    const post = makeSnapshot(postNations, -10, 10);
    const battle = makeBattle();

    // Engine basis: loser GBR ships g1+g2 (200 HP), damageReport 30+100=130 →
    // lossFraction 0.65 >= 0.5 → DECISIVE = ±10. The bridge must agree with the
    // engine (10), NOT with a post-snapshot recompute — which would see only
    // the survivor g1 at 70 HP (lossFraction 30/70 ≈ 0.43 = MAJOR = 5).
    const outcome = mapBattleOutcome(battle, pre, post);
    expect(outcome.warScoreDelta).toBe(10);

    // Prove this test discriminates: a post-battle re-derivation would report
    // only a MAJOR ±5 (the exact bug reviewer finding 1 called out). Pinning it
    // here documents that the fix's pre-battle basis is what makes the test
    // pass, and any future move back to the post-snapshot basis fails.
    const postSurvivorHp = 70;
    const postLossHp = 30;
    const postFraction = postLossHp / postSurvivorHp;
    expect(postFraction >= 0.25 && postFraction < 0.5).toBe(true);
    expect(postFraction >= 0.5).toBe(false);
    // Sanity: the war score the engine truly wrote is the decisive ±10.
    const preWar = pre.wars.wars.find((w) => w.id === "war_1")!;
    const postWar = post.wars.wars.find((w) => w.id === "war_1")!;
    expect(Math.abs(postWar.attackerWarScore - preWar.attackerWarScore)).toBe(10);
  });

  it("re-derives the engine's ±5 MAJOR class off the PRE-battle snapshot (distinct from a post-basis DECISIVE)", () => {
    // Loser (GBR) has a single g1 @ 100 HP; damageReport 40 → lossFraction 0.40
    // (>= 0.25, < 0.5) → the engine applies MAJOR = ±5.
    const preNations = new Map<string, import("@bluewave/campaign").NationState>();
    preNations.set("GBR", makeNation("GBR", "fleet-GBR", [{ id: "g1", hitPoints: 100 }]));
    preNations.set("FRA", makeNation("FRA", "fleet-FRA", [{ id: "f1", hitPoints: 100 }]));
    const pre = makeSnapshot(preNations, 0, 0);

    // POST: consequences reduced g1 to 60 HP; engine applied MAJOR (±5).
    const postNations = new Map<string, import("@bluewave/campaign").NationState>();
    postNations.set("GBR", makeNation("GBR", "fleet-GBR", [{ id: "g1", hitPoints: 60 }]));
    postNations.set("FRA", makeNation("FRA", "fleet-FRA", [{ id: "f1", hitPoints: 80 }]));
    const post = makeSnapshot(postNations, -5, 5);
    const battle: BattleInstance = {
      ...makeBattle(),
      result: {
        winnerId: "FRA",
        loserId: "GBR",
        attackerLosses: [],
        defenderLosses: [],
        damageReport: { g1: SafeInt(40) },
        explanation: [],
      },
    };

    // Bridge pins the engine's MAJOR (±5), NOT a post-basis recompute which
    // would see 40/60 ≈ 0.67 → DECISIVE (±10) — discriminating the minor/major
    // boundary from the decisive boundary.
    const outcome = mapBattleOutcome(battle, pre, post);
    expect(outcome.warScoreDelta).toBe(5);
    const preWar = pre.wars.wars.find((w) => w.id === "war_1")!;
    const postWar = post.wars.wars.find((w) => w.id === "war_1")!;
    expect(Math.abs(postWar.attackerWarScore - preWar.attackerWarScore)).toBe(5);
  });

  it("an unavailable losing nation on the pre-month snapshot -> warScoreDelta 0 AND a recorded reason (never fabricated +10)", () => {
    // The losing nation GBR is NOT in the pre-month nations map at all.
    const preNations = new Map<string, import("@bluewave/campaign").NationState>();
    preNations.set("FRA", makeNation("FRA", "fleet-FRA", [{ id: "f1", hitPoints: 100 }]));
    const pre = makeSnapshot(preNations, 0, 0);
    const postNations = new Map<string, import("@bluewave/campaign").NationState>();
    postNations.set("FRA", makeNation("FRA", "fleet-FRA", [{ id: "f1", hitPoints: 80 }]));
    const post = makeSnapshot(postNations, -10, 10);
    const battle = makeBattle();

    const outcome = mapBattleOutcome(battle, pre, post);
    expect(outcome.warScoreDelta).toBe(0);
    expect(outcome.explanation.join(" ")).toContain("unavailable on the pre-month snapshot");
  });

  it("a non-decided battle (null winner/loser) -> warScoreDelta 0 (ADR-0026 §7)", () => {
    const battle: BattleInstance = {
      ...makeBattle(),
      result: {
        winnerId: null,
        loserId: null,
        attackerLosses: ["g1"],
        defenderLosses: [],
        damageReport: { g1: SafeInt(100) },
        explanation: [],
      },
    };
    const outcome = mapBattleOutcome(
      battle,
      makeSnapshot(new Map(), 0, 0),
      makeSnapshot(new Map(), 0, 0),
    );
    expect(outcome.warScoreDelta).toBe(0);
  });
});
