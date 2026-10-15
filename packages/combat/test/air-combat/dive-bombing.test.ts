//packages/combat/test/air-combat/dive-bombing.test.ts
// AC-11 (INC-4): Dive-bombing penetration multiplier.
import { describe, expect, it } from "vite-plus/test";
import {
  computeBombDamageMultiplier,
  computePenetrationMultiplier,
  AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP,
  AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP,
} from "../../src/air-combat/index.js";

describe("AC-11: Dive-bombing penetration", () => {
  describe("computeBombDamageMultiplier", () => {
    it("dive bomb → 8_500bp (0.85x damage modifier for penetration step)", () => {
      const result = computeBombDamageMultiplier(true);
      expect(Number(result)).toBe(AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP);
      expect(Number(result)).toBe(8_500);
    });

    it("level bomb → 10_000bp (1.0x — no change)", () => {
      const result = computeBombDamageMultiplier(false);
      expect(Number(result)).toBe(AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP);
      expect(Number(result)).toBe(10_000);
    });
  });

  describe("computePenetrationMultiplier", () => {
    it("dive bomb → 8_500bp (improved penetration vs level bomb of same mass)", () => {
      const result = computePenetrationMultiplier(true);
      expect(Number(result)).toBe(AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP);
      expect(Number(result)).toBe(8_500);
    });

    it("level bomb → 10_000bp (baseline penetration)", () => {
      const result = computePenetrationMultiplier(false);
      expect(Number(result)).toBe(AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP);
      expect(Number(result)).toBe(10_000);
    });
  });

  it("dive bombing penetration is 8_500bp of equal-mass level bomb = 0.85x", () => {
    // 8_500 / 10_000 = 0.85
    const divePen = Number(computePenetrationMultiplier(true));
    const levelPen = Number(computePenetrationMultiplier(false));
    expect(divePen / levelPen).toBe(0.85);
  });

  it("multiplier does NOT change bomb explosive mass (penetration modifier only)", () => {
    // The function returns a pure multiplier — explosive mass is handled separately.
    // This test verifies the multiplier is a constant, not a function of bomb mass.
    const diveResult = computePenetrationMultiplier(true);
    const levelResult = computePenetrationMultiplier(false);

    // Both are constant values
    expect(Number(diveResult)).toBe(AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP);
    expect(Number(levelResult)).toBe(AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP);
  });
});
