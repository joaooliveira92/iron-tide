import { describe, it, expect } from "vite-plus/test";
import {
  getFireRofPenaltyBp,
  getFireNightSignatureBp,
  computeFireSmokeStrength,
  resolveFireProgression,
} from "@bluewave/combat/damage";
import { FIRE_SPREAD_CREATED } from "@bluewave/combat/damage";

function rngThat(returnValues: Record<string, number>): (stream: string) => number {
  return (stream: string) => returnValues[stream] ?? 0.5;
}

describe("getFireRofPenaltyBp", () => {
  it("returns 9_500 for intensity 1..2_499", () => {
    expect(getFireRofPenaltyBp(1)).toBe(9_500);
    expect(getFireRofPenaltyBp(1_000)).toBe(9_500);
    expect(getFireRofPenaltyBp(2_499)).toBe(9_500);
  });

  it("returns 8_500 for intensity 2_500..4_999", () => {
    expect(getFireRofPenaltyBp(2_500)).toBe(8_500);
    expect(getFireRofPenaltyBp(3_000)).toBe(8_500);
    expect(getFireRofPenaltyBp(4_999)).toBe(8_500);
  });

  it("returns 7_000 for intensity 5_000..7_499", () => {
    expect(getFireRofPenaltyBp(5_000)).toBe(7_000);
    expect(getFireRofPenaltyBp(6_000)).toBe(7_000);
    expect(getFireRofPenaltyBp(7_499)).toBe(7_000);
  });

  it("returns 5_000 for intensity 7_500..10_000", () => {
    expect(getFireRofPenaltyBp(7_500)).toBe(5_000);
    expect(getFireRofPenaltyBp(8_000)).toBe(5_000);
    expect(getFireRofPenaltyBp(10_000)).toBe(5_000);
  });

  it("returns 10_000 for intensity 0 (no fire)", () => {
    expect(getFireRofPenaltyBp(0)).toBe(10_000);
  });

  it("returns 10_000 for negative intensity", () => {
    expect(getFireRofPenaltyBp(-1)).toBe(10_000);
  });

  it("returns 10_000 for intensity above 10_000", () => {
    expect(getFireRofPenaltyBp(15_000)).toBe(10_000);
  });
});

describe("getFireNightSignatureBp", () => {
  it("returns 10_000 for intensity 0..999", () => {
    expect(getFireNightSignatureBp(0)).toBe(10_000);
    expect(getFireNightSignatureBp(500)).toBe(10_000);
    expect(getFireNightSignatureBp(999)).toBe(10_000);
  });

  it("returns 12_500 for intensity 1_000..2_499", () => {
    expect(getFireNightSignatureBp(1_000)).toBe(12_500);
    expect(getFireNightSignatureBp(2_000)).toBe(12_500);
    expect(getFireNightSignatureBp(2_499)).toBe(12_500);
  });

  it("returns 15_000 for intensity 2_500..4_999", () => {
    expect(getFireNightSignatureBp(2_500)).toBe(15_000);
    expect(getFireNightSignatureBp(3_500)).toBe(15_000);
    expect(getFireNightSignatureBp(4_999)).toBe(15_000);
  });

  it("returns 20_000 for intensity 5_000..7_499", () => {
    expect(getFireNightSignatureBp(5_000)).toBe(20_000);
    expect(getFireNightSignatureBp(6_000)).toBe(20_000);
    expect(getFireNightSignatureBp(7_499)).toBe(20_000);
  });

  it("returns 30_000 for intensity 7_500..10_000", () => {
    expect(getFireNightSignatureBp(7_500)).toBe(30_000);
    expect(getFireNightSignatureBp(10_000)).toBe(30_000);
  });

  it("returns 10_000 for negative intensity", () => {
    expect(getFireNightSignatureBp(-1)).toBe(10_000);
  });
});

describe("computeFireSmokeStrength", () => {
  it("computes smoke with ordinary fuel (8_000 bp)", () => {
    const result = computeFireSmokeStrength(5_000, "ORDINARY");
    expect(result).toBe(4_000);
  });

  it("computes smoke with oil fuel (12_000 bp) — higher than ordinary", () => {
    const oilResult = computeFireSmokeStrength(5_000, "OIL");
    const ordResult = computeFireSmokeStrength(5_000, "ORDINARY");
    expect(oilResult).toBeGreaterThan(ordResult);
    expect(oilResult).toBe(6_000);
  });

  it("computes smoke with coal fuel (15_000 bp) — highest", () => {
    const coalResult = computeFireSmokeStrength(5_000, "COAL");
    const oilResult = computeFireSmokeStrength(5_000, "OIL");
    expect(coalResult).toBeGreaterThan(oilResult);
    expect(coalResult).toBe(7_500);
  });

  it("computes smoke with mixed fuel (10_000 bp)", () => {
    const result = computeFireSmokeStrength(5_000, "MIXED");
    expect(result).toBe(5_000);
  });

  it("uses default fuel multiplier (8_000 bp) for unknown fuel class", () => {
    const result = computeFireSmokeStrength(5_000, "UNKNOWN_FUEL");
    expect(result).toBe(4_000);
  });

  it("accepts custom ventilation multiplier", () => {
    const result = computeFireSmokeStrength(5_000, "ORDINARY", 5_000);
    expect(result).toBe(2_000);
  });

  it("returns 0 for intensity 0 regardless of fuel", () => {
    const result = computeFireSmokeStrength(0, "COAL");
    expect(result).toBe(0);
  });

  it("handles very high intensity (10_000) correctly", () => {
    const result = computeFireSmokeStrength(10_000, "ORDINARY");
    expect(result).toBe(8_000);
  });
});

describe("resolveFireProgression", () => {
  it("no-op when no fires", () => {
    const result = resolveFireProgression([], "ORDINARY", null);
    expect(result.fireRecords).toHaveLength(0);
    expect(result.newFires).toHaveLength(0);
  });

  it("intensity decays by FIRE_INTENSITY_DECAY_PER_MINUTE (200)", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" }];
    const result = resolveFireProgression(fires, "ORDINARY", null);
    expect(result.fireRecords).toHaveLength(1);
    expect(result.fireRecords[0]!.intensityBp).toBe(4_800);
    expect(result.fireRecords[0]!.locationId).toBe("COMP-1");
  });

  it("fire removed when intensity < 1 after decay", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 150, cause: "FIRE_SOURCE_CREATED" }];
    const result = resolveFireProgression(fires, "ORDINARY", null);
    expect(result.fireRecords).toHaveLength(0);
  });

  it("fire removed when intensity exactly 0 after decay", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 200, cause: "FIRE_SOURCE_CREATED" }];
    const result = resolveFireProgression(fires, "ORDINARY", null);
    expect(result.fireRecords).toHaveLength(0);
  });

  it("fire removed when intensity is 1 after decay (1 - 200 < 1)", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 1, cause: "FIRE_SOURCE_CREATED" }];
    const result = resolveFireProgression(fires, "ORDINARY", null);
    expect(result.fireRecords).toHaveLength(0);
  });

  it("fire at intensity 201 survives decay (201 - 200 = 1 >= 1)", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 201, cause: "FIRE_SOURCE_CREATED" }];
    const result = resolveFireProgression(fires, "ORDINARY", null);
    expect(result.fireRecords).toHaveLength(1);
    expect(result.fireRecords[0]!.intensityBp).toBe(1);
  });

  it("multiple fires all decay independently", () => {
    const fires = [
      { locationId: "COMP-1", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" },
      { locationId: "COMP-2", intensityBp: 100, cause: "FIRE_SOURCE_CREATED" },
      { locationId: "COMP-3", intensityBp: 10_000, cause: "FIRE_SOURCE_CREATED" },
    ];
    const result = resolveFireProgression(fires, "ORDINARY", null);
    expect(result.fireRecords).toHaveLength(2);
    expect(result.fireRecords[0]!.intensityBp).toBe(4_800);
    expect(result.fireRecords[0]!.locationId).toBe("COMP-1");
    expect(result.fireRecords[1]!.intensityBp).toBe(9_800);
    expect(result.fireRecords[1]!.locationId).toBe("COMP-3");
  });

  it("spread creates new fires when RNG is provided (ORDINARY = 10_000 bp fire risk)", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" }];
    const rng = rngThat({ "battle/ship/damage/fire_spread/COMP-1": 0.05 });
    const result = resolveFireProgression(fires, "ORDINARY", rng);
    expect(result.fireRecords).toHaveLength(1);
    expect(result.newFires).toHaveLength(1);
    expect(result.newFires[0]!.locationId).toBe("COMP-1_adj");
    expect(result.newFires[0]!.intensityBp).toBe(3_000);
    expect(result.newFires[0]!.cause).toBe(FIRE_SPREAD_CREATED);
  });

  it("no spread when RNG draw exceeds spread chance", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" }];
    const rng = rngThat({ "battle/ship/damage/fire_spread/COMP-1": 0.5 });
    const result = resolveFireProgression(fires, "ORDINARY", rng);
    expect(result.fireRecords).toHaveLength(1);
    expect(result.newFires).toHaveLength(0);
  });

  it("no spread without RNG (keyedRng is null)", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" }];
    const result = resolveFireProgression(fires, "ORDINARY", null);
    expect(result.fireRecords).toHaveLength(1);
    expect(result.newFires).toHaveLength(0);
  });

  it("spread uses correct keyed RNG stream name", () => {
    const streams: string[] = [];
    const trackingRng = (stream: string) => {
      streams.push(stream);
      return 0.05;
    };
    const fires = [{ locationId: "COMP-1", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" }];
    resolveFireProgression(fires, "ORDINARY", trackingRng);
    expect(streams).toContain("battle/ship/damage/fire_spread/COMP-1");
  });

  it("spread uses ship type fire risk multiplier", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" }];
    const rng = rngThat({ "battle/ship/damage/fire_spread/COMP-1": 0.05 });
    const result = resolveFireProgression(fires, "DESTROYER", rng);
    expect(result.newFires).toHaveLength(1);
  });

  it("does not spread extinguished fires", () => {
    const fires = [{ locationId: "COMP-1", intensityBp: 50, cause: "FIRE_SOURCE_CREATED" }];
    const rng = rngThat({ "battle/ship/damage/fire_spread/COMP-1": 0.0 });
    const result = resolveFireProgression(fires, "ORDINARY", rng);
    expect(result.fireRecords).toHaveLength(0);
    expect(result.newFires).toHaveLength(0);
  });
});
