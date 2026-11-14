import { describe, it, expect } from "vite-plus/test";
import { generateBattles, GENERATION_STAGES } from "@bluewave/combat/generation";
import { defaultTwoNationFixture } from "../fixtures/generation-fixture.js";

function inputs(snapshot: ReturnType<typeof defaultTwoNationFixture>) {
  return {
    snapshot,
    campaignMonth: "1880-02",
    campaignSeed: "seed",
    rngVersion: "1",
    formulaVersion: "1",
    rulesetVersion: "1",
    contentVersion: "0.3.0",
    resolveStrength: () => 200,
    resolveShipType: () => "BB",
    resolveReadiness: () => 80,
  };
}

describe("BattleGenerator / generateBattles (AC-12 / INC-5)", () => {
  it("executes all 15 stages in exact order", () => {
    const result = generateBattles(inputs(defaultTwoNationFixture()));
    expect(GENERATION_STAGES).toHaveLength(15);
    const record = result.records[0];
    expect(record).toBeDefined();
    const stageIds = record!.stageRecords.map((s) => s.stageId);
    expect(stageIds).toEqual([...GENERATION_STAGES]);
  });

  it("produces a manifest, seed, and BattleGenerationRecord for a reachable opportunity", () => {
    const result = generateBattles(inputs(defaultTwoNationFixture()));
    expect(result.manifests.length).toBeGreaterThan(0);
    const manifest = result.manifests[0]!;
    expect(manifest.manifestHash).toBeTruthy();
    expect(manifest.battleSeed).toBeTruthy();
    expect(manifest.sides.map((s) => s.sideId)).toEqual(["ATTACKER", "DEFENDER"]);
    expect(manifest.persistentAssets.length).toBeGreaterThan(0);
    expect(manifest.persistentAssets.length).toBeLessThanOrEqual(5);
    expect(result.records[0]!.recordHash).toBeTruthy();
    expect(result.records[0]!.reservations).toEqual(manifest.persistentAssets);
    const mandatory = result.records[0]!.mandatorySelections;
    expect(mandatory.length).toBeGreaterThanOrEqual(1);
  });

  it("is deterministic across two engine instances", () => {
    const fixture = defaultTwoNationFixture();
    const a = generateBattles(inputs(fixture));
    const b = generateBattles(inputs(fixture));
    expect(a.manifests[0]!.manifestHash).toBe(b.manifests[0]!.manifestHash);
    expect(a.manifests[0]!.battleSeed).toBe(b.manifests[0]!.battleSeed);
    expect(a.records[0]!.recordHash).toBe(b.records[0]!.recordHash);
  });

  it("no-war snapshot yields successful empty records", () => {
    const snapshot = defaultTwoNationFixture();
    const noWar = { ...snapshot, wars: { ...snapshot.wars, wars: [] } };
    const result = generateBattles(inputs(noWar));
    expect(result.records).toEqual([]);
    expect(result.manifests).toEqual([]);
    expect(result.rejections).toEqual([]);
  });

  it("rejected (limit-exceeded) opportunities are excluded without seed", () => {
    const result = generateBattles(inputs(defaultTwoNationFixture()));
    expect(result.rejections.length).toBeGreaterThanOrEqual(1);
  });

  describe("strength floor is enforced per side (rules §6.1, §10)", () => {
    const strengthBySide = (attacker: number, defender: number) => ({
      ...inputs(defaultTwoNationFixture()),
      resolveStrength: (shipId: string) => (shipId.startsWith("gb_") ? attacker : defender),
    });

    it("rejects the mission when the defender alone is below the floor, even if the attacker is huge", () => {
      const result = generateBattles(strengthBySide(1_000, 10));
      expect(result.manifests).toEqual([]);
      expect(result.rejections.length).toBeGreaterThanOrEqual(1);
    });

    it("rejects the mission when the attacker alone is below the floor, even if the defender is huge", () => {
      const result = generateBattles(strengthBySide(10, 1_000));
      expect(result.manifests).toEqual([]);
    });

    it("accepts the mission when each side clears the floor on its own", () => {
      const result = generateBattles(strengthBySide(1_000, 1_000));
      expect(result.manifests.length).toBeGreaterThan(0);
    });

    it("evaluates a cruiser-sized engagement against the cruiser floor when it is below the fleet floor", () => {
      const cruiserSized = strengthBySide(60, 80);
      const result = generateBattles(cruiserSized);
      expect(result.manifests.map((m) => m.missionType)).toEqual(["CRUISER_BATTLE"]);
      expect(result.rejections).toEqual(["opp_war_1_area_battle_fleet_battle_1880-02"]);
    });

    it("rejects a cruiser-sized engagement below the cruiser floor", () => {
      const result = generateBattles(strengthBySide(60, 40));
      expect(result.manifests).toEqual([]);
      expect(result.rejections).toHaveLength(2);
    });

    it("still limits an area to one battle per month when both floors are cleared", () => {
      const result = generateBattles(strengthBySide(1_000, 1_000));
      expect(result.manifests.map((m) => m.missionType)).toEqual(["FLEET_BATTLE"]);
      expect(result.rejections).toEqual(["opp_war_1_area_battle_cruiser_battle_1880-02"]);
    });

    it("applies a content-supplied floor in place of the defaults", () => {
      const small = strengthBySide(40, 40);
      expect(generateBattles(small).manifests).toEqual([]);
      const lowered = generateBattles({
        ...small,
        minimumStrength: { FLEET_BATTLE: 30, CRUISER_BATTLE: 15 },
      });
      expect(lowered.manifests.length).toBeGreaterThan(0);
      const raised = generateBattles({
        ...strengthBySide(1_000, 1_000),
        minimumStrength: { FLEET_BATTLE: 100_000, CRUISER_BATTLE: 50_000 },
      });
      expect(raised.manifests).toEqual([]);
    });
  });
});
