import { describe, expect, it } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  computeFunnelSmokeDensity,
  FUNNEL_SMOKE_BASE_DENSITY,
  WEATHER_SMOKE_STATE_INVARIANT_FAILED,
} from "../../src/smoke/index.js";

// Expected density formula:
// floor(FUNNEL_SMOKE_BASE_DENSITY * fuelMultiplier * powerMultiplier * machineryCondition / 10_000^3)
// capped at 10_000.

function expectedDensity(fuelBp: number, powerBp: number, machCondBp: number): number {
  const raw = Math.floor(
    (FUNNEL_SMOKE_BASE_DENSITY * fuelBp * powerBp * machCondBp) / (10_000 * 10_000 * 10_000),
  );
  return Math.min(10_000, raw);
}

describe("computeFunnelSmokeDensity", () => {
  it("coal fuel at full power (15_000 multiplier band) produces correct density", () => {
    const density = computeFunnelSmokeDensity({ fuelType: "coal", powerSettingBp: 9_500 });
    // coal 15_000 * power 15_000 = 225_000_000
    // base 5_000 * 225_000_000 * 10_000 (default mach) / 1e12 = 5_000 * 225_000 = 1_125_000_000 / 1e12... wait
    // Let me compute: 5_000 * 15_000 * 15_000 * 10_000 = 5_000 * 2_250_000_000 = 11_250_000_000_000
    // / 1_000_000_000_000 = 11_250
    // capped at 10_000
    // Actually let me recompute: 10_000 * 10_000 * 10_000 = 1_000_000_000_000
    // numerator = 5_000 * 15_000 * 15_000 * 10_000 = 5_000 * 2_250_000_000 = 11_250_000_000_000
    // = 11_250_000_000_000 / 1_000_000_000_000 = 11.25, floor = 11...
    // Wait that's wrong for the multipliers being in basis points.
    // Let me reconsider: the base density is 5_000 bp = 5_000 / 10_000 = 0.5 opacity
    // fuelMultiplierBp = 15_000 -> 1.5x
    // powerMultiplierBp = 15_000 -> 1.5x
    // machineryConditionBp = 10_000 -> 1.0x
    // Result = 0.5 * 1.5 * 1.5 * 1.0 = 1.125 -> floor(1.125 * 10_000) = floor(11_250)... capped at 10_000
    // Actually the formula says: min(10_000, floor(baseFunnelSmokeBp * fuelMultiplierBp * powerMultiplierBp * machCondBp / 10_000^3))
    // baseFunnelSmokeBp = 5_000, fuelMultiplierBp = 15_000, powerMultiplierBp = 15_000, machCondBp = 10_000
    // numerator = 5_000 * 15_000 * 15_000 * 10_000 = 11_250_000_000_000
    // denominator = 10_000^3 = 1_000_000_000_000
    // result = 11_250_000_000_000 / 1_000_000_000_000 = 11.25, floor = 11 ... that seems wrong
    // Wait, I think bp here means the values are already in basis points.
    // 5_000 bp * 15_000 bp * 15_000 bp * 10_000 bp / (10_000 * 10_000 * 10_000)
    // = 5_000 * 15_000 * 15_000 * 10_000 / 1_000_000_000_000
    // = 11_250_000_000_000 / 1_000_000_000_000
    // = 11
    // Hmm but that gives a very small number. Let me re-read the formula.
    //
    // The formula says: min(10_000, floor(baseFunnelSmokeBp * fuelMultiplierBp * powerMultiplierBp * machineryConditionMultiplierBp / 10_000^3))
    // So it's treating all values as basis points (1/10_000th), and dividing by 10_000^3 to normalize.
    // The result is in bp. So it's correct that coal at full power gives 11 bp.
    // That seems very low. But the ticket says this is the formula from DESIGN-42 §11.
    // Let me just compute it properly and test for the correct output.
    //
    // Actually, the formula I should compute:
    // 5_000 * 15_000 * 15_000 * 10_000 / 1_000_000_000_000
    // = 11_250_000_000_000 / 1_000_000_000_000
    // = 11.25
    // floor = 11
    const expected = expectedDensity(15_000, 15_000, 10_000);
    expect(density).toBe(expected);
  });

  it("oil fuel at cruise power (5_000..7_499 band = 10_000 multiplier)", () => {
    const density = computeFunnelSmokeDensity({ fuelType: "oil", powerSettingBp: 6_000 });
    // oil = 7_500, power = 10_000 (from 5_000..7_499 band)
    // 5_000 * 7_500 * 10_000 * 10_000 / 1_000_000_000_000 = 5_000 * 75_000_000_000 / 1_000_000_000_000 = 375_000_000_000_000 / 1_000_000_000_000 = 375
    // Actually: 5_000 * 7_500 * 10_000 * 10_000 = 5_000 * 7_500 * 100_000_000 = 3_750_000_000_000
    // Wait: 7_500 * 10_000 * 10_000 = 750_000_000_000
    // Then * 5_000 = 3_750_000_000_000_000
    // / 1_000_000_000_000 = 3_750
    // That's 3_750 bp
    const expected = expectedDensity(7_500, 10_000, 10_000);
    expect(density).toBe(expected);
  });

  it("nuclear fuel produces 0 density", () => {
    const density = computeFunnelSmokeDensity({ fuelType: "nuclear", powerSettingBp: 9_500 });
    // nuclear = 0
    expect(density).toBe(0);
  });

  it("mixed fuel at mid power (7_500..9_499 band)", () => {
    const density = computeFunnelSmokeDensity({ fuelType: "mixed", powerSettingBp: 8_000 });
    // mixed = 12_500, power = 12_500 (from 7_500..9_499 band)
    const expected = expectedDensity(12_500, 12_500, 10_000);
    expect(density).toBe(expected);
  });

  it("invalid fuel type throws WEATHER_SMOKE_STATE_INVARIANT_FAILED", () => {
    expect(() =>
      computeFunnelSmokeDensity({ fuelType: "hydrogen", powerSettingBp: 9_500 }),
    ).toThrowError(BluewaveError);
    try {
      computeFunnelSmokeDensity({ fuelType: "hydrogen", powerSettingBp: 9_500 });
    } catch (e) {
      expect(isBluewaveError(e)).toBe(true);
      expect((e as BluewaveError).context.code).toBe(WEATHER_SMOKE_STATE_INVARIANT_FAILED);
    }
  });

  it("power band boundaries produce correct multipliers", () => {
    // Below 5_000: multiplier = 5_000
    const band0 = computeFunnelSmokeDensity({ fuelType: "coal", powerSettingBp: 4_999 });
    const exp0 = expectedDensity(15_000, 5_000, 10_000);
    expect(band0).toBe(exp0);

    // At 5_000: multiplier = 10_000
    const band1 = computeFunnelSmokeDensity({ fuelType: "coal", powerSettingBp: 5_000 });
    const exp1 = expectedDensity(15_000, 10_000, 10_000);
    expect(band1).toBe(exp1);

    // At 7_499: multiplier = 10_000
    const band2 = computeFunnelSmokeDensity({ fuelType: "coal", powerSettingBp: 7_499 });
    const exp2 = expectedDensity(15_000, 10_000, 10_000);
    expect(band2).toBe(exp2);

    // At 7_500: multiplier = 12_500
    const band3 = computeFunnelSmokeDensity({ fuelType: "coal", powerSettingBp: 7_500 });
    const exp3 = expectedDensity(15_000, 12_500, 10_000);
    expect(band3).toBe(exp3);

    // At 9_499: multiplier = 12_500
    const band4 = computeFunnelSmokeDensity({ fuelType: "coal", powerSettingBp: 9_499 });
    const exp4 = expectedDensity(15_000, 12_500, 10_000);
    expect(band4).toBe(exp4);

    // At 9_500: multiplier = 15_000
    const band5 = computeFunnelSmokeDensity({ fuelType: "coal", powerSettingBp: 9_500 });
    const exp5 = expectedDensity(15_000, 15_000, 10_000);
    expect(band5).toBe(exp5);
  });

  it("machinery condition modifier reduces density", () => {
    // Full power, coal, damaged machinery (5_000 bp)
    const full = computeFunnelSmokeDensity({
      fuelType: "coal",
      powerSettingBp: 9_500,
      machineryConditionBp: 10_000,
    });
    const damaged = computeFunnelSmokeDensity({
      fuelType: "coal",
      powerSettingBp: 9_500,
      machineryConditionBp: 5_000,
    });
    expect(damaged).toBeLessThan(full);
    const expDamaged = expectedDensity(15_000, 15_000, 5_000);
    expect(damaged).toBe(expDamaged);
  });

  it("density is capped at 10_000", () => {
    // This should produce 10_000 if the formula would exceed it
    // With base 5_000, fuel 15_000 (coal), power 15_000 (max), mach 15_000 (hypothetical boost)
    // = 5_000 * 15_000 * 15_000 * 15_000 / 1_000_000_000_000
    // = 16_875_000_000_000_000 / 1_000_000_000_000 = 16_875 -> capped at 10_000
    const density = computeFunnelSmokeDensity({
      fuelType: "coal",
      powerSettingBp: 9_500,
      machineryConditionBp: 15_000,
    });
    expect(density).toBe(10_000);
  });

  it("default machinery condition is 10_000", () => {
    const explicit = computeFunnelSmokeDensity({
      fuelType: "oil",
      powerSettingBp: 6_000,
      machineryConditionBp: 10_000,
    });
    const implicit = computeFunnelSmokeDensity({ fuelType: "oil", powerSettingBp: 6_000 });
    expect(implicit).toBe(explicit);
  });
});
