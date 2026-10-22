import type { BattleInstance, CampaignSlot, CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

function makeNation(
  id: string,
  ships: Array<{ id: string; loc: string; underConstruction?: boolean }>,
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
    fleets: ships.length
      ? [
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
              designVersionId: "",
              hitPoints: SafeInt(100),
              maxHitPoints: SafeInt(100),
              speed: SafeInt(10),
              firepower: SafeInt(200),
              armor: SafeInt(10),
              isUnderConstruction: s.underConstruction ?? false,
              constructionProgress: SafeInt(0),
              constructionTotalWork: SafeInt(0),
              readiness: s.underConstruction ? "WORKING_UP" : "ACTIVE",
              crewQuality: SafeInt(100),
            })),
          },
        ]
      : [],
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
  };
}

function makeSnapshot(warActive = true, coLocated = true): CampaignSnapshot {
  const nations = new Map();
  nations.set(
    "GBR",
    makeNation("GBR", [
      { id: "g1", loc: "a-1" },
      { id: "g2", loc: "a-1" },
    ]),
  );
  nations.set(
    "FRA",
    makeNation(
      "FRA",
      coLocated
        ? [
            { id: "f1", loc: "a-1" },
            { id: "f2", loc: "a-1" },
          ]
        : [
            { id: "f1", loc: "a-2" },
            { id: "f2", loc: "a-2" },
          ],
    ),
  );
  const slot: CampaignSlot = { nationId: "GBR", type: "playable" };
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "phase-gen-test",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [slot],
    world: { areas: [], routes: [], ports: [] },
    nations,
    wars: {
      wars: warActive
        ? [
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
          ]
        : [],
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
    compatibilityVersion: "1.2.0",
  };
}

describe("battle_generation phase (AC-12)", () => {
  it("order 7.5 runs before battle_resolution; generated battles resolve in the same month", () => {
    const snapshot = makeSnapshot();
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const result = executor.execute(snapshot, [], "seed", collector);

    const battles = result.finalSnapshot.wars.battles;
    const pendingAfter = battles.filter((b) => b.phase === "pending").length;
    const resolved = battles.filter((b) => b.phase === "resolved").length;
    expect(battles.length).toBeGreaterThan(0);
    expect(pendingAfter).toBe(0);
    expect(resolved).toBe(battles.length);
  });

  it("no-war snapshot produces no manifests and unchanged state (no-op hash)", () => {
    const snapshot = makeSnapshot(false);
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const result = executor.execute(snapshot, [], "seed", collector);
    expect(result.finalSnapshot.wars.battleManifests ?? []).toEqual([]);
    expect(result.finalSnapshot.wars.battles).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("non-co-located war produces no battle", () => {
    const snapshot = makeSnapshot(true, false);
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const result = executor.execute(snapshot, [], "seed", collector);
    expect(result.finalSnapshot.wars.battles).toEqual([]);
  });

  it("manifests carry manifestHash and feed battle_resolution", () => {
    const snapshot = makeSnapshot();
    const executor = new MonthExecutor();
    const collector = new DiagnosticCollector();
    const result = executor.execute(snapshot, [], "seed", collector);

    const manifests = result.finalSnapshot.wars.battleManifests ?? [];
    expect(manifests.length).toBeGreaterThan(0);
    for (const m of manifests) {
      expect(m.manifestHash).toBeTruthy();
      expect(m.battleSeed).toBeTruthy();
    }
    for (const b of result.finalSnapshot.wars.battles) {
      expect(b.manifestHash).toBeTruthy();
    }
  });

  it("deterministic: same inputs -> same closing hash", () => {
    const a = new MonthExecutor().execute(makeSnapshot(), [], "seed", new DiagnosticCollector());
    const b = new MonthExecutor().execute(makeSnapshot(), [], "seed", new DiagnosticCollector());
    expect(a.finalSnapshot.wars.battles.map((x: BattleInstance) => x.id)).toEqual(
      b.finalSnapshot.wars.battles.map((x: BattleInstance) => x.id),
    );
  });

  it("a side with only working-up ships (not under construction) fights no battle (S-1 ticket 06)", () => {
    const snapshot = makeSnapshot();
    const fra = snapshot.nations.get("FRA")!;
    fra.fleets = fra.fleets.map((f) => ({
      ...f,
      ships: f.ships.map((s) => ({
        ...s,
        readiness: "WORKING_UP" as const,
        crewQuality: SafeInt(0),
      })),
    }));
    const result = new MonthExecutor().execute(snapshot, [], "seed", new DiagnosticCollector());
    expect(result.finalSnapshot.wars.battles).toEqual([]);
  });

  it("reserve ships are not reserved for an ordinary battle (S-1 ticket 06)", () => {
    const snapshot = makeSnapshot();
    const gbr = snapshot.nations.get("GBR")!;
    gbr.fleets[0]!.ships.push({
      ...gbr.fleets[0]!.ships[0]!,
      id: "g_reserve",
      readiness: "RESERVE",
    });
    const result = new MonthExecutor().execute(snapshot, [], "seed", new DiagnosticCollector());
    const manifests = result.finalSnapshot.wars.battleManifests ?? [];
    const reservedIds = manifests.flatMap((m) => m.persistentAssets);
    expect(reservedIds).not.toContain("g_reserve");
    const reserve = result.finalSnapshot.nations
      .get("GBR")!
      .fleets.flatMap((f) => f.ships)
      .find((s) => s.id === "g_reserve");
    expect(reserve?.inBattleId).toBeUndefined();
  });
});
