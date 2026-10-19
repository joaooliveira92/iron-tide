import { describe, it, expect, vi } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import type { CampaignSnapshot, NationState, Ship } from "@bluewave/campaign";

const saveStoreMocks = vi.hoisted(() => ({
  load: vi.fn(),
}));
vi.mock("@bluewave/persistence", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  SaveStore: class {
    load = saveStoreMocks.load;
  },
}));

import { runBattleGenerate, type BattleGenerateCliOptions } from "../src/commands.js";
import { runCli } from "./runCli.js";
import { FIXTURE_PRESTIGE_RULES } from "./prestige-fixture.js";

function stdoutSpy() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true as any);
}

function makeShip(id: string, nationId: string, firepower: number): Ship {
  return {
    id,
    name: id,
    classId: "battleship",
    nationId,
    locationAreaId: "area_battle",
    designVersionId: "des_BB",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(20),
    firepower: SafeInt(firepower),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
  };
}

function makeNation(id: string, ships: Ship[]): NationState {
  return {
    prestige: SafeInt(20),
    id,
    name: id,
    tag: id,
    treasury: SafeInt(1000),
    income: SafeInt(100),
    expenses: SafeInt(50),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [
      {
        id: `${id}_fleet`,
        nationId: id,
        name: `${id} Fleet`,
        locationAreaId: "area_battle",
        ships,
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
  };
}

function fixtureSnapshot(): CampaignSnapshot {
  const nations = new Map<string, NationState>();
  nations.set(
    "GBR",
    makeNation("GBR", [makeShip("gb_bb1", "GBR", 300), makeShip("gb_bb2", "GBR", 300)]),
  );
  nations.set("FRA", makeNation("FRA", [makeShip("fra_bb1", "FRA", 300)]));
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "battle-generate-test",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [
      { nationId: "GBR", type: "playable" },
      { nationId: "FRA", type: "ai" },
    ],
    world: { areas: [], routes: [], ports: [] },
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
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  };
}

function baseOptions(): BattleGenerateCliOptions {
  return {
    manifest: "/p",
    contentDir: "/c",
    outputDir: "/tmp/out",
    outputMode: "human",
    saveDir: "/s",
    seed: "seed-1",
    rngVersion: "1",
    formulaVersion: "1",
    contentVersion: "0.1.0",
  };
}

describe("runBattleGenerate", () => {
  it("returns validation-error when the save cannot be loaded", async () => {
    saveStoreMocks.load.mockReturnValue(undefined);
    expect(await runCli(runBattleGenerate(baseOptions(), "/s"))).toBe("validation-error");
  });

  it("generates battles from a saved snapshot and prints a human summary", async () => {
    saveStoreMocks.load.mockReturnValue({
      snapshot: fixtureSnapshot(),
      envelope: {},
      rawHash: "h",
    });
    const spy = stdoutSpy();
    const result = await runCli(runBattleGenerate(baseOptions(), "/s"));
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Battle generation complete");
    expect(output).toContain("battle_war_1_area_battle_fleet_battle_1");
    expect(output).toContain("GBR vs FRA");
    spy.mockRestore();
  });

  it("emits structured JSON output in --json mode", async () => {
    saveStoreMocks.load.mockReturnValue({
      snapshot: fixtureSnapshot(),
      envelope: {},
      rawHash: "h",
    });
    const spy = stdoutSpy();
    const result = await runCli(runBattleGenerate({ ...baseOptions(), outputMode: "json" }, "/s"));
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    const jsonLine = output.split("\n").find((line) => line.includes("battleIds"));
    expect(jsonLine).toBeDefined();
    const parsed = JSON.parse(jsonLine!);
    expect(parsed).toHaveProperty("records");
    expect(parsed.battleIds).toEqual(["battle_war_1_area_battle_fleet_battle_1"]);
    expect(parsed).toHaveProperty("manifests");
    expect(parsed.rejections).toEqual(["opp_war_1_area_battle_cruiser_battle_1"]);
    spy.mockRestore();
  });

  it("defaults campaignMonth from the snapshot's turnNumber and rulesetVersion from the snapshot", async () => {
    saveStoreMocks.load.mockReturnValue({
      snapshot: fixtureSnapshot(),
      envelope: {},
      rawHash: "h",
    });
    const spy = stdoutSpy();
    const result = await runCli(runBattleGenerate({ ...baseOptions(), outputMode: "json" }, "/s"));
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    const jsonLine = output.split("\n").find((line) => line.includes("battleIds"));
    const parsed = JSON.parse(jsonLine!);
    // campaignMonth defaults to the snapshot's turnNumber ("1"), which shows
    // up as the trailing month segment of the generated battle id.
    expect(parsed.battleIds[0]).toMatch(/_1$/);
    // rulesetVersion defaults to the snapshot's rulesetVersion ("0.1.0"),
    // which flows into every stage record.
    expect(parsed.records[0].stageRecords[0].rulesetVersion).toBe("0.1.0");
    spy.mockRestore();
  });

  it("honors explicit overrides for campaignMonth and rulesetVersion instead of the snapshot defaults", async () => {
    saveStoreMocks.load.mockReturnValue({
      snapshot: fixtureSnapshot(),
      envelope: {},
      rawHash: "h",
    });
    const spy = stdoutSpy();
    const result = await runCli(
      runBattleGenerate(
        { ...baseOptions(), outputMode: "json", campaignMonth: "1880-06", rulesetVersion: "2.0.0" },
        "/s",
      ),
    );
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    const jsonLine = output.split("\n").find((line) => line.includes("battleIds"));
    const parsed = JSON.parse(jsonLine!);
    expect(parsed.battleIds[0]).toContain("1880-06");
    expect(parsed.records[0].stageRecords[0].rulesetVersion).toBe("2.0.0");
    spy.mockRestore();
  });
});
