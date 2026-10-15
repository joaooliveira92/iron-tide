// INC-6 — Per-minute flooding resolution functions (DESIGN-41 §§14-18).
// Proves: severity classification, speed/stability multipliers, speed-pressure bands,
// net delta computation, high-speed loss checks, and full progression resolution.
import { describe, it, expect } from "vite-plus/test";
import {
  getFloodingSeverity,
  getFloodingSpeedMultiplierBp,
  getFloodingStabilityMultiplierBp,
  getSpeedPressureMultiplierBp,
  computeNetFloodingDelta,
  checkHighSpeedLoss,
  floodedWaterBpFromKg,
  resolveFloodingProgression,
} from "../../src/damage/index.js";
import type { FloodingSourceRecord } from "../../src/damage/state.js";

// Helpers

/** Deterministic RNG returning a fixed value for any stream. */
function fixedRng(value: number): (stream: string) => number {
  return () => value;
}

/** RNG that tracks which streams were requested. */
function trackingRng(): {
  rng: (stream: string) => number;
  streams: string[];
} {
  const streams: string[] = [];
  return {
    rng: (stream: string) => {
      streams.push(stream);
      return 0.0;
    },
    streams,
  };
}

// getFloodingSeverity

describe("INC-6: getFloodingSeverity (§14)", () => {
  it("below 500 returns MINOR", () => {
    expect(getFloodingSeverity(0)).toBe("MINOR");
    expect(getFloodingSeverity(100)).toBe("MINOR");
    expect(getFloodingSeverity(499)).toBe("MINOR");
  });

  it("500-1499 returns SERIOUS", () => {
    expect(getFloodingSeverity(500)).toBe("SERIOUS");
    expect(getFloodingSeverity(1_000)).toBe("SERIOUS");
    expect(getFloodingSeverity(1_499)).toBe("SERIOUS");
  });

  it("1500-2999 returns MAJOR", () => {
    expect(getFloodingSeverity(1_500)).toBe("MAJOR");
    expect(getFloodingSeverity(2_000)).toBe("MAJOR");
    expect(getFloodingSeverity(2_999)).toBe("MAJOR");
  });

  it("3000+ returns CRITICAL", () => {
    expect(getFloodingSeverity(3_000)).toBe("CRITICAL");
    expect(getFloodingSeverity(5_000)).toBe("CRITICAL");
    expect(getFloodingSeverity(10_000)).toBe("CRITICAL");
  });

  it("boundary values are correct", () => {
    // Exact thresholds
    expect(getFloodingSeverity(499)).toBe("MINOR");
    expect(getFloodingSeverity(500)).toBe("SERIOUS");
    expect(getFloodingSeverity(1_499)).toBe("SERIOUS");
    expect(getFloodingSeverity(1_500)).toBe("MAJOR");
    expect(getFloodingSeverity(2_999)).toBe("MAJOR");
    expect(getFloodingSeverity(3_000)).toBe("CRITICAL");
  });

  it("negative values return MINOR", () => {
    expect(getFloodingSeverity(-1)).toBe("MINOR");
    expect(getFloodingSeverity(-500)).toBe("MINOR");
  });
});

// getFloodingSpeedMultiplierBp

describe("INC-6: getFloodingSpeedMultiplierBp (§15)", () => {
  it("MINOR returns 9_500 bp", () => {
    expect(getFloodingSpeedMultiplierBp("MINOR")).toBe(9_500);
  });

  it("SERIOUS returns 8_000 bp", () => {
    expect(getFloodingSpeedMultiplierBp("SERIOUS")).toBe(8_000);
  });

  it("MAJOR returns 6_000 bp", () => {
    expect(getFloodingSpeedMultiplierBp("MAJOR")).toBe(6_000);
  });

  it("CRITICAL returns 3_500 bp", () => {
    expect(getFloodingSpeedMultiplierBp("CRITICAL")).toBe(3_500);
  });
});

// getFloodingStabilityMultiplierBp

describe("INC-6: getFloodingStabilityMultiplierBp (§15)", () => {
  it("MINOR returns 9_500 bp", () => {
    expect(getFloodingStabilityMultiplierBp("MINOR")).toBe(9_500);
  });

  it("SERIOUS returns 8_500 bp", () => {
    expect(getFloodingStabilityMultiplierBp("SERIOUS")).toBe(8_500);
  });

  it("MAJOR returns 7_000 bp", () => {
    expect(getFloodingStabilityMultiplierBp("MAJOR")).toBe(7_000);
  });

  it("CRITICAL returns 5_000 bp", () => {
    expect(getFloodingStabilityMultiplierBp("CRITICAL")).toBe(5_000);
  });
});

// getSpeedPressureMultiplierBp

describe("INC-6: getSpeedPressureMultiplierBp (§16)", () => {
  it("speed ≤ 10 kt returns 7_500 bp (incl exact 10)", () => {
    expect(getSpeedPressureMultiplierBp(0)).toBe(7_500);
    expect(getSpeedPressureMultiplierBp(5)).toBe(7_500);
    expect(getSpeedPressureMultiplierBp(10)).toBe(7_500);
  });

  it("10 < speed ≤ 15 returns 10_000 bp", () => {
    expect(getSpeedPressureMultiplierBp(11)).toBe(10_000);
    expect(getSpeedPressureMultiplierBp(15)).toBe(10_000);
  });

  it("15 < speed ≤ 20 returns 12_500 bp", () => {
    expect(getSpeedPressureMultiplierBp(16)).toBe(12_500);
    expect(getSpeedPressureMultiplierBp(20)).toBe(12_500);
  });

  it("20 < speed ≤ 25 returns 15_000 bp", () => {
    expect(getSpeedPressureMultiplierBp(21)).toBe(15_000);
    expect(getSpeedPressureMultiplierBp(25)).toBe(15_000);
  });

  it("speed > 25 returns 20_000 bp", () => {
    expect(getSpeedPressureMultiplierBp(26)).toBe(20_000);
    expect(getSpeedPressureMultiplierBp(30)).toBe(20_000);
    expect(getSpeedPressureMultiplierBp(100)).toBe(20_000);
  });
});

// computeNetFloodingDelta

describe("INC-6: computeNetFloodingDelta (§18)", () => {
  it("basic calculation without modifiers", () => {
    // totalIngress=500, speed=10 → speedPressure=7500bp, progressiveFailure=10000bp (1.0)
    // rawIngress = floor(500 * 7500 * 10000 / 100_000_000) = floor(375) = 375
    // netDelta = max(0, 375 - 0 - 0) = 375
    const result = computeNetFloodingDelta(500, 10, 10_000, 0, 0);
    expect(result.netDeltaKgMin).toBe(375);
    expect(result.dewateringKgMin).toBe(0);
  });

  it("effective pumping reduces net delta", () => {
    // rawIngress = 375, pumping = 100, no repair → netDelta = max(0, 375-100-0) = 275
    const result = computeNetFloodingDelta(500, 10, 10_000, 100, 0);
    expect(result.netDeltaKgMin).toBe(275);
    expect(result.dewateringKgMin).toBe(0);
  });

  it("pumping + repair both reduce net delta", () => {
    // rawIngress = 375, pumping = 100, repair = 50 → netDelta = max(0, 375-100-50) = 225
    const result = computeNetFloodingDelta(500, 10, 10_000, 100, 50);
    expect(result.netDeltaKgMin).toBe(225);
    expect(result.dewateringKgMin).toBe(0);
  });

  it("pumping > ingress triggers dewatering", () => {
    // rawIngress = 375, pumping = 400, repair = 0 → raw - pumping = -25 < 0 → dewatering
    const result = computeNetFloodingDelta(500, 10, 10_000, 400, 0);
    expect(result.netDeltaKgMin).toBe(0);
    expect(result.dewateringKgMin).toBe(100); // DEWATERING_RATE_KG_MIN
  });

  it("pumping + repair > ingress triggers dewatering", () => {
    // rawIngress = 375, pumping = 300, repair = 100 → raw - total = -25 < 0 → dewatering
    const result = computeNetFloodingDelta(500, 10, 10_000, 300, 100);
    expect(result.netDeltaKgMin).toBe(0);
    expect(result.dewateringKgMin).toBe(100);
  });

  it("zero ingress produces zero net delta and no dewatering", () => {
    const result = computeNetFloodingDelta(0, 10, 10_000, 0, 0);
    expect(result.netDeltaKgMin).toBe(0);
    expect(result.dewateringKgMin).toBe(0);
  });

  it("zero ingress with active pumping causes dewatering (removing existing water)", () => {
    // rawIngress = 0, pumping = 100 → raw - pumping = -100 < 0 → dewatering occurs
    // Net delta = 0 (no new ingress), but dewatering removes existing water
    const result = computeNetFloodingDelta(0, 10, 10_000, 100, 0);
    expect(result.netDeltaKgMin).toBe(0);
    expect(result.dewateringKgMin).toBe(100); // DEWATERING_RATE_KG_MIN
  });

  it("progressive failure multiplier increases raw ingress", () => {
    // speed=10 → 7500bp, progressiveFailure=15000bp (1.5x)
    // rawIngress = floor(500 * 7500 * 15000 / 100_000_000) = floor(562.5) = 562
    const result = computeNetFloodingDelta(500, 10, 15_000, 0, 0);
    expect(result.netDeltaKgMin).toBe(562);
    expect(result.dewateringKgMin).toBe(0);
  });

  it("max(0, ...) guards negative net delta", () => {
    // rawIngress = 375, pumping = 1000, repair = 0 → 375 - 1000 = -625 → max(0, -625) = 0
    const result = computeNetFloodingDelta(500, 10, 10_000, 1000, 0);
    expect(result.netDeltaKgMin).toBe(0);
    expect(result.dewateringKgMin).toBe(100);
  });

  it("speed-pressure multiplier affects raw ingress", () => {
    // speed=30kt → 20000bp, progressiveFailure=10000bp
    // rawIngress = floor(500 * 20000 * 10000 / 100_000_000) = floor(1000) = 1000
    const highSpeed = computeNetFloodingDelta(500, 30, 10_000, 0, 0);
    expect(highSpeed.netDeltaKgMin).toBe(1000);

    // speed=10kt → 7500bp
    // rawIngress = floor(500 * 7500 * 10000 / 100_000_000) = floor(375) = 375
    const lowSpeed = computeNetFloodingDelta(500, 10, 10_000, 0, 0);
    expect(lowSpeed.netDeltaKgMin).toBe(375);

    // Higher speed = larger delta
    expect(highSpeed.netDeltaKgMin).toBeGreaterThan(lowSpeed.netDeltaKgMin);
  });
});

// checkHighSpeedLoss

describe("INC-6: checkHighSpeedLoss (§17)", () => {
  it("MAJOR severity at 20-25 kt with RNG draw below 500 bp (5%) triggers loss", () => {
    // probability = 500 bp = 5%, draw 0.04 => 400 bp < 500 => loss
    expect(checkHighSpeedLoss("MAJOR", 22, fixedRng(0.04))).toBe(true);
  });

  it("MAJOR severity at 20-25 kt with RNG draw above 500 bp does not trigger loss", () => {
    // draw 0.06 => 600 bp >= 500 => no loss
    expect(checkHighSpeedLoss("MAJOR", 22, fixedRng(0.06))).toBe(false);
  });

  it("CRITICAL severity at 20-25 kt with RNG draw below 2000 bp (20%) triggers loss", () => {
    // probability = 2000 bp = 20%, draw 0.15 => 1500 bp < 2000 => loss
    expect(checkHighSpeedLoss("CRITICAL", 22, fixedRng(0.15))).toBe(true);
  });

  it("CRITICAL severity at >25 kt with RNG draw below 5000 bp (50%) triggers loss", () => {
    // probability = 5000 bp = 50%, draw 0.25 => 2500 bp < 5000 => loss
    expect(checkHighSpeedLoss("CRITICAL", 30, fixedRng(0.25))).toBe(true);
  });

  it("CRITICAL severity at >25 kt with RNG draw above 5000 bp does not trigger loss", () => {
    // draw 0.6 => 6000 bp >= 5000 => no loss
    expect(checkHighSpeedLoss("CRITICAL", 30, fixedRng(0.6))).toBe(false);
  });

  it("no RNG function (null) always returns false", () => {
    expect(checkHighSpeedLoss("MAJOR", 22, null)).toBe(false);
    expect(checkHighSpeedLoss("CRITICAL", 30, null)).toBe(false);
  });

  it("speed ≤ 20 kt returns false regardless of severity", () => {
    expect(checkHighSpeedLoss("MAJOR", 20, fixedRng(0.0))).toBe(false);
    expect(checkHighSpeedLoss("CRITICAL", 15, fixedRng(0.0))).toBe(false);
    expect(checkHighSpeedLoss("MAJOR", 10, fixedRng(0.0))).toBe(false);
  });

  it("MINOR severity always returns false even at high speed", () => {
    expect(checkHighSpeedLoss("MINOR", 22, fixedRng(0.0))).toBe(false);
    expect(checkHighSpeedLoss("MINOR", 30, fixedRng(0.0))).toBe(false);
  });

  it("SERIOUS severity always returns false even at high speed", () => {
    expect(checkHighSpeedLoss("SERIOUS", 22, fixedRng(0.0))).toBe(false);
    expect(checkHighSpeedLoss("SERIOUS", 30, fixedRng(0.0))).toBe(false);
  });

  it("uses the correct RNG stream name", () => {
    const { rng, streams } = trackingRng();
    checkHighSpeedLoss("MAJOR", 22, rng);
    expect(streams).toContain("battle/ship/flooding/high_speed_loss");
  });
});

// floodedWaterBpFromKg — kg -> bp of displacement (ADR-0047 decision 4)

describe("INC-6: floodedWaterBpFromKg (§14/§48 v12; ADR-0047 d4)", () => {
  // The 1880 ironclad fixture hull: 11 000 t design displacement (ADR-0046).
  // bp = floor(mass × 10_000 / displacement), so 1 bp == 1 100 kg on this hull.
  const HULL = 11_000_000;

  it("converts mass to bp with explicit floor rounding", () => {
    expect(floodedWaterBpFromKg(548_900, HULL)).toBe(499);
    expect(floodedWaterBpFromKg(548_901, HULL)).toBe(499); // floor, not round
    expect(floodedWaterBpFromKg(1_100, HULL)).toBe(1);
    expect(floodedWaterBpFromKg(0, HULL)).toBe(0);
  });

  it("severity thresholds 499/500, 1_499/1_500, 2_999/3_000 bp (the reviewer F1 boundary set)", () => {
    expect(getFloodingSeverity(floodedWaterBpFromKg(548_900, HULL))).toBe("MINOR"); // 499 bp
    expect(getFloodingSeverity(floodedWaterBpFromKg(550_000, HULL))).toBe("SERIOUS"); // 500 bp
    expect(getFloodingSeverity(floodedWaterBpFromKg(1_648_900, HULL))).toBe("SERIOUS"); // 1 499 bp
    expect(getFloodingSeverity(floodedWaterBpFromKg(1_650_000, HULL))).toBe("MAJOR"); // 1 500 bp
    expect(getFloodingSeverity(floodedWaterBpFromKg(3_298_900, HULL))).toBe("MAJOR"); // 2 999 bp
    expect(getFloodingSeverity(floodedWaterBpFromKg(3_300_000, HULL))).toBe("CRITICAL"); // 3 000 bp
  });

  it("regression: a kg mass fed straight into the bp thresholds read CRITICAL on the old code", () => {
    // 500_000 kg is 45% of the hull — as kg it exceeds the 3_000 "threshold";
    // as bp of displacement it is only 454 bp -> MINOR. The old call sites fed
    // kg into getFloodingSeverity and read CRITICAL on any real hull.
    expect(floodedWaterBpFromKg(500_000, HULL)).toBe(454);
    expect(getFloodingSeverity(floodedWaterBpFromKg(500_000, HULL))).toBe("MINOR");
    // The next severity band genuinely starts at 500 bp (550_000 kg on this hull).
    expect(getFloodingSeverity(floodedWaterBpFromKg(550_000, HULL))).toBe("SERIOUS");
  });

  it("fails closed on a non-positive design displacement (DESIGN-41 §1)", () => {
    expect(() => floodedWaterBpFromKg(1_000, 0)).toThrow();
    expect(() => floodedWaterBpFromKg(1_000, -5)).toThrow();
    expect(() => floodedWaterBpFromKg(-1, 11_000_000)).toThrow();
    expect(() => floodedWaterBpFromKg(1.5, 11_000_000)).toThrow();
  });
});

// resolveFloodingProgression

describe("INC-6: resolveFloodingProgression (§18)", () => {
  const sampleRecord: FloodingSourceRecord = {
    compartmentId: "COMP-1",
    rateKgMin: 500,
    cause: "FLOODING_SOURCE_CREATED",
  };
  // 1 000 t test hull: bp == kg / 100, so the legacy bp-valued masses below map
  // to whole bp bands exactly (accumulation stays kg — ADR-0047 decision 4).
  const TEST_HULL = 1_000_000;

  it("no flooding sources produces zero delta", () => {
    const result = resolveFloodingProgression([], 0, TEST_HULL, 10, 10_000, 0, 0, null);
    expect(result.netDeltaKgMin).toBe(0);
    expect(result.nextFloodedWaterBp).toBe(0);
    expect(result.severity).toBe("MINOR");
    expect(result.highSpeedLoss).toBe(false);
  });

  it("single source increases flooded water", () => {
    const result = resolveFloodingProgression([sampleRecord], 0, TEST_HULL, 10, 10_000, 0, 0, null);
    // rawIngress = floor(500 * 7500 * 10000 / 100_000_000) = 375
    expect(result.netDeltaKgMin).toBe(375);
    expect(result.nextFloodedWaterBp).toBe(375);
    expect(result.severity).toBe("MINOR");
    expect(result.highSpeedLoss).toBe(false);
  });

  it("multiple sources are summed for net delta", () => {
    const records: FloodingSourceRecord[] = [
      { compartmentId: "COMP-1", rateKgMin: 300, cause: "BATTLE_DAMAGE" },
      { compartmentId: "COMP-2", rateKgMin: 200, cause: "BATTLE_DAMAGE" },
    ];
    // totalIngress = 500, same as single source test
    const result = resolveFloodingProgression(records, 0, TEST_HULL, 10, 10_000, 0, 0, null);
    expect(result.netDeltaKgMin).toBe(375);
    expect(result.nextFloodedWaterBp).toBe(375);
  });

  it("accumulated flooded WATER MASS affects severity via bp of displacement", () => {
    // 200_000 kg on a 1 000 t hull = 2_000 bp (MAJOR band); the +375 kg delta
    // keeps it in MAJOR (2_003 bp). The accumulator stays in kg throughout.
    const result = resolveFloodingProgression(
      [sampleRecord],
      200_000,
      TEST_HULL,
      10,
      10_000,
      0,
      0,
      null,
    );
    expect(result.nextFloodedWaterBp).toBe(200_375);
    expect(result.severity).toBe("MAJOR");
  });

  it("high speed and high severity triggers loss check", () => {
    // 300_000 kg on a 1 000 t hull = 3_000 bp (CRITICAL), speed 30 kt.
    // With RNG=0.04 → draw 400bp < 5000bp (critical OVER_25) → loss
    const result = resolveFloodingProgression(
      [sampleRecord],
      300_000,
      TEST_HULL,
      30,
      10_000,
      0,
      0,
      fixedRng(0.04),
    );
    expect(result.severity).toBe("CRITICAL");
    expect(result.highSpeedLoss).toBe(true);
  });

  it("§17 eligibility boundary: bp severity (not kg) decides whether the draw is consumed", () => {
    // The 11 000 t ironclad hull (ADR-0046). 1_648_900 kg = 1_499 bp -> SERIOUS
    // (not eligible: no draw), 1_650_000 kg = 1_500 bp -> MAJOR (eligible: the
    // keyed draw is consumed). The old code fed kg into severity, so eligibility
    // flipped at 3_000 kg instead of 3_000 bp.
    const ironclad = 11_000_000;
    const seriousRng = trackingRng();
    const serious = resolveFloodingProgression(
      [sampleRecord],
      1_648_900,
      ironclad,
      30,
      10_000,
      0,
      0,
      seriousRng.rng,
    );
    expect(serious.severity).toBe("SERIOUS");
    expect(serious.highSpeedLoss).toBe(false);
    expect(seriousRng.streams).toEqual([]); // §17 gate refuses at SERIOUS: no draw

    const majorRng = trackingRng();
    const major = resolveFloodingProgression(
      [sampleRecord],
      1_650_000,
      ironclad,
      30,
      10_000,
      0,
      0,
      majorRng.rng,
    );
    expect(major.severity).toBe("MAJOR");
    expect(major.highSpeedLoss).toBe(true); // draw 0 < MAJOR OVER_25 1_500 bp
    expect(majorRng.streams).toContain("battle/ship/flooding/high_speed_loss");
  });

  it("pumping reduces net delta in full progression", () => {
    const result = resolveFloodingProgression(
      [sampleRecord],
      0,
      TEST_HULL,
      10,
      10_000,
      200,
      0,
      null,
    );
    // rawIngress=375, pumping=200 → netDelta=175
    expect(result.netDeltaKgMin).toBe(175);
    expect(result.nextFloodedWaterBp).toBe(175);
  });

  it("flooding records are returned unchanged", () => {
    const records: FloodingSourceRecord[] = [sampleRecord];
    const result = resolveFloodingProgression(records, 0, TEST_HULL, 10, 10_000, 0, 0, null);
    expect(result.floodingRecords).toBe(records);
    expect(result.floodingRecords.length).toBe(1);
    expect(result.floodingRecords[0].compartmentId).toBe("COMP-1");
  });
});
