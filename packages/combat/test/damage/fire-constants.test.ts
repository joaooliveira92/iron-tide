//packages/combat/test/damage/fire-constants.test.ts
// Tests for fire resolution constants (DESIGN-41 §20-25).
// Verifies policy IDs are stable, band arrays are complete, and constants are non-negative.
import { describe, it, expect } from "vite-plus/test";
import {
  firePolicyId,
  FIRE_RESOLUTION_RULESET_VERSION,
  FIRE_RESOLUTION_FORMULA_VERSION,
  FIRE_RISK_MULTIPLIERS,
  FIRE_ROF_PENALTY_BANDS,
  FIRE_NIGHT_SIGNATURE_BANDS,
  FIRE_SMOKE_FUEL_MULTIPLIERS,
  FIRE_DEFAULT_VENTILATION_MULTIPLIER_BP,
  FIRE_SUPPRESSION_BASE_RATE_BP,
  FIRE_SPREAD_BASE_PROBABILITY_BP,
  FIRE_INTENSITY_DECAY_PER_MINUTE,
  FIRE_SPREAD_BASE_INTENSITY_BP,
} from "../../src/damage/fireConstants.js";

describe("fireConstants: policy IDs", () => {
  it("firePolicyId is stable", () => {
    expect(firePolicyId).toBe("fire_resolution_v1");
  });

  it("FIRE_RESOLUTION_RULESET_VERSION is stable", () => {
    expect(FIRE_RESOLUTION_RULESET_VERSION).toBe("fire_resolution_ruleset_v1");
  });

  it("FIRE_RESOLUTION_FORMULA_VERSION is stable", () => {
    expect(FIRE_RESOLUTION_FORMULA_VERSION).toBe("fire_resolution_formula_v1");
  });
});

describe("fireConstants: all constants are non-negative", () => {
  it("FIRE_DEFAULT_VENTILATION_MULTIPLIER_BP is non-negative", () => {
    expect(FIRE_DEFAULT_VENTILATION_MULTIPLIER_BP).toBeGreaterThanOrEqual(0);
  });

  it("FIRE_SUPPRESSION_BASE_RATE_BP is non-negative", () => {
    expect(FIRE_SUPPRESSION_BASE_RATE_BP).toBeGreaterThanOrEqual(0);
  });

  it("FIRE_SPREAD_BASE_PROBABILITY_BP is non-negative", () => {
    expect(FIRE_SPREAD_BASE_PROBABILITY_BP).toBeGreaterThanOrEqual(0);
  });

  it("FIRE_INTENSITY_DECAY_PER_MINUTE is non-negative", () => {
    expect(FIRE_INTENSITY_DECAY_PER_MINUTE).toBeGreaterThanOrEqual(0);
  });

  it("FIRE_SPREAD_BASE_INTENSITY_BP is non-negative", () => {
    expect(FIRE_SPREAD_BASE_INTENSITY_BP).toBeGreaterThanOrEqual(0);
  });
});

describe("fireConstants: band arrays are complete", () => {
  it("FIRE_ROF_PENALTY_BANDS covers 1..10_000 with no gaps", () => {
    // Check adjacent bands: band N's maxIntensity + 1 should equal band N+1's minIntensity
    for (let i = 0; i < FIRE_ROF_PENALTY_BANDS.length - 1; i++) {
      const current = FIRE_ROF_PENALTY_BANDS[i]!;
      const next = FIRE_ROF_PENALTY_BANDS[i + 1]!;
      expect(current.maxIntensity + 1).toBe(next.minIntensity);
    }
    // First band starts at 1
    expect(FIRE_ROF_PENALTY_BANDS[0]!.minIntensity).toBe(1);
    // Last band ends at 10_000
    expect(FIRE_ROF_PENALTY_BANDS[FIRE_ROF_PENALTY_BANDS.length - 1]!.maxIntensity).toBe(10_000);
  });

  it("FIRE_NIGHT_SIGNATURE_BANDS covers 0..10_000 with no gaps", () => {
    for (let i = 0; i < FIRE_NIGHT_SIGNATURE_BANDS.length - 1; i++) {
      const current = FIRE_NIGHT_SIGNATURE_BANDS[i]!;
      const next = FIRE_NIGHT_SIGNATURE_BANDS[i + 1]!;
      expect(current.maxIntensity + 1).toBe(next.minIntensity);
    }
    // First band starts at 0
    expect(FIRE_NIGHT_SIGNATURE_BANDS[0]!.minIntensity).toBe(0);
    // Last band ends at 10_000
    expect(FIRE_NIGHT_SIGNATURE_BANDS[FIRE_NIGHT_SIGNATURE_BANDS.length - 1]!.maxIntensity).toBe(
      10_000,
    );
  });

  it("FIRE_ROF_PENALTY_BANDS has 4 bands", () => {
    expect(FIRE_ROF_PENALTY_BANDS.length).toBe(4);
  });

  it("FIRE_NIGHT_SIGNATURE_BANDS has 5 bands", () => {
    expect(FIRE_NIGHT_SIGNATURE_BANDS.length).toBe(5);
  });
});

describe("fireConstants: ship type multipliers", () => {
  it("ORDINARY is 10_000", () => {
    expect(FIRE_RISK_MULTIPLIERS.ORDINARY).toBe(10_000);
  });

  it("CARRIER is 15_000", () => {
    expect(FIRE_RISK_MULTIPLIERS.CARRIER).toBe(15_000);
  });

  it("TRANSPORT is 13_000", () => {
    expect(FIRE_RISK_MULTIPLIERS.TRANSPORT).toBe(13_000);
  });

  it("AMC is 12_500", () => {
    expect(FIRE_RISK_MULTIPLIERS.AMC).toBe(12_500);
  });

  it("AV is 13_000", () => {
    expect(FIRE_RISK_MULTIPLIERS.AV).toBe(13_000);
  });

  it("PRE_DREADNOUGHT is 12_000", () => {
    expect(FIRE_RISK_MULTIPLIERS.PRE_DREADNOUGHT).toBe(12_000);
  });
});

describe("fireConstants: fuel multipliers", () => {
  it("ORDINARY is 8_000", () => {
    expect(FIRE_SMOKE_FUEL_MULTIPLIERS.ORDINARY).toBe(8_000);
  });

  it("OIL is 12_000", () => {
    expect(FIRE_SMOKE_FUEL_MULTIPLIERS.OIL).toBe(12_000);
  });

  it("COAL is 15_000", () => {
    expect(FIRE_SMOKE_FUEL_MULTIPLIERS.COAL).toBe(15_000);
  });

  it("MIXED is 10_000", () => {
    expect(FIRE_SMOKE_FUEL_MULTIPLIERS.MIXED).toBe(10_000);
  });
});
