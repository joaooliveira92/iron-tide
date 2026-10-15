import { describe, expect, it } from "vite-plus/test";
import type { BattleOutcome, ClosingSnapshotSummary } from "../src/simulation.js";

/**
 * Type/canary test for the web-facing flat `BattleOutcome` surface added to
 * `ClosingSnapshotSummary` (INC-1). It does not exercise any authoritative
 * engine behavior — it only proves the type's shape constructs and surfaces
 * correctly for vanilla-safe (renderer) consumption.
 */
describe("BattleOutcome type surface (INC-1)", () => {
  it("constructs a ClosingSnapshotSummary carrying a flat BattleOutcome array", () => {
    const battleOutcome: BattleOutcome = {
      battleId: "btl_1880_02_01",
      areaId: "area_lige_ocean_north",
      attackerId: "uk",
      defenderId: "ger",
      winnerId: "uk",
      loserId: "ger",
      warScoreDelta: 5,
      attackerLosses: ["ship_hms_vanguard"],
      defenderLosses: ["ship_sms_hohenzollern"],
      explanation: ["Decisive naval victory for uk near area_lige_ocean_north"],
    };

    const summary: ClosingSnapshotSummary = {
      revision: 2,
      month: { month: 2, year: 1880 },
      submarinePools: [],
      minePressure: [],
      landTargetDamage: [],
      battleOutcomes: [battleOutcome],
      activeWars: [],
    };

    expect(summary.battleOutcomes).toHaveLength(1);
    const surfaced = summary.battleOutcomes[0];
    expect(surfaced.battleId).toBe("btl_1880_02_01");
    expect(surfaced.attackerId).toBe("uk");
    expect(surfaced.defenderId).toBe("ger");
    expect(surfaced.winnerId).toBe("uk");
    expect(surfaced.loserId).toBe("ger");
    expect(surfaced.warScoreDelta).toBe(5);
    expect(surfaced.attackerLosses).toEqual(["ship_hms_vanguard"]);
    expect(surfaced.defenderLosses).toEqual(["ship_sms_hohenzollern"]);
    // activeWars stays intact for backward compatibility.
    expect(summary.activeWars).toEqual([]);
  });

  it("carries a null winner/loser and empty arrays for an inconclusive battle", () => {
    const inconclusive: BattleOutcome = {
      battleId: "btl_1880_03_04",
      areaId: "area_baltic",
      attackerId: "fr",
      defenderId: "ru",
      winnerId: null,
      loserId: null,
      warScoreDelta: 0,
      attackerLosses: [],
      defenderLosses: [],
      explanation: [],
    };

    const summary: ClosingSnapshotSummary = {
      revision: 3,
      month: { month: 3, year: 1880 },
      submarinePools: [],
      minePressure: [],
      landTargetDamage: [],
      battleOutcomes: [inconclusive],
      activeWars: [],
    };

    expect(summary.battleOutcomes[0].winnerId).toBeNull();
    expect(summary.battleOutcomes[0].loserId).toBeNull();
    expect(summary.battleOutcomes[0].attackerLosses).toEqual([]);
    expect(summary.battleOutcomes[0].defenderLosses).toEqual([]);
    expect(summary.battleOutcomes[0].explanation).toEqual([]);
  });

  it("supports an empty battleOutcomes array for a no-battle month", () => {
    const summary: ClosingSnapshotSummary = {
      revision: 1,
      month: { month: 1, year: 1880 },
      submarinePools: [],
      minePressure: [],
      landTargetDamage: [],
      battleOutcomes: [],
      activeWars: [],
    };
    expect(summary.battleOutcomes).toEqual([]);
  });
});
