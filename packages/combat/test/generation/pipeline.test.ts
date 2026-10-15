//packages/combat/test/generation/pipeline.test.ts
import { describe, it, expect } from "vite-plus/test";
import {
  generateBattles,
  GENERATION_STAGES,
  BattleGenerator,
} from "../../src/generation/pipeline.js";
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
    // Real composition: co-located ships are gathered, CORE-assigned, and reserved.
    expect(manifest.persistentAssets.length).toBeGreaterThan(0);
    expect(manifest.persistentAssets.length).toBeLessThanOrEqual(5);
    expect(result.records[0]!.recordHash).toBeTruthy();
    expect(result.records[0]!.reservations).toEqual(manifest.persistentAssets);
    // At least the mandatory CORE assets were selected for each side.
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

  it("BattleGenerator facade matches the pure entry point", () => {
    const generator = new BattleGenerator();
    const a = generator.generate(inputs(defaultTwoNationFixture()));
    const b = generateBattles(inputs(defaultTwoNationFixture()));
    expect(a.manifests[0]!.battleSeed).toBe(b.manifests[0]!.battleSeed);
  });

  it("rejected (limit-exceeded) opportunities are excluded without seed", () => {
    const result = generateBattles(inputs(defaultTwoNationFixture()));
    // 2 opportunities in one area; the monthly limit rejects the second.
    expect(result.rejections.length).toBeGreaterThanOrEqual(1);
  });

  // docs/rules/battle-generation.md §6.1/§10: the strength floor applies PER SIDE
  // ("minimum eligible combat strength of 300 points per side"). The pipeline used
  // to sum BOTH sides' assets and test that total against each side's floor, so a
  // weak side was carried by a strong opponent.
  describe("strength floor is enforced per side (rules §6.1, §10)", () => {
    const strengthBySide = (attacker: number, defender: number) => ({
      ...inputs(defaultTwoNationFixture()),
      // GBR ships are the attacker, FRA the defender in the fixture war.
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
  });
});
