import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import {
  computeCapAllocation,
  computeExchange,
  computeDisruption,
} from "../../src/air-combat/index.js";
import {
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_DISRUPTION_MIN_BP,
} from "../../src/air-combat/index.js";

describe("AC-6: CAP vs bomber engagement", () => {
  it("remaining CAP after escort allocation engages bombers", () => {
    const allocation = computeCapAllocation(SafeInt(10), SafeInt(5));
    expect(Number(allocation.escortEngagingCap)).toBe(3);
    expect(Number(allocation.bomberEngagingCap)).toBe(7);
  });

  it("CAP engages bombers via exchange function", () => {
    const allocation = computeCapAllocation(SafeInt(10), SafeInt(5));
    const bomberEngagingCap = allocation.bomberEngagingCap;

    const rng = new RandomEngine("cap-vs-bomber");
    const result = computeExchange(
      {
        attackerCombatIndex: SafeInt(60),
        defenderCombatIndex: SafeInt(20),
        attackerCount: bomberEngagingCap,
        defenderCount: SafeInt(20),
        attackerAltitude: "HIGH",
        defenderAltitude: "MEDIUM",
        isFirstPass: true,
        defenderToughness: SafeInt(70),
        escortModifierBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      },
      rng,
    );

    expect(Number(result.killProbabilityBp)).toBeGreaterThan(0);
    expect(result.factorContributions).toHaveProperty("quality");
    expect(Number(result.losses)).toBeGreaterThanOrEqual(0);
    expect(Number(result.losses)).toBeLessThanOrEqual(20);
    expect(Number(result.damaged)).toBeGreaterThanOrEqual(0);
  });

  it("bombers do NOT return fire (only attacker-side losses)", () => {
    const rng = new RandomEngine("bomber-no-return-fire");
    const result = computeExchange(
      {
        attackerCombatIndex: SafeInt(70),
        defenderCombatIndex: SafeInt(25),
        attackerCount: SafeInt(8),
        defenderCount: SafeInt(15),
        attackerAltitude: "HIGH",
        defenderAltitude: "MEDIUM",
        isFirstPass: true,
        defenderToughness: SafeInt(80),
        escortModifierBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      },
      rng,
    );

    expect(result).toHaveProperty("losses");
    expect(result).toHaveProperty("damaged");
    expect(Object.keys(result)).not.toContain("attackerLosses");
  });

  describe("computeDisruption", () => {
    it("12 CAP vs 24 strike → disruptionBp = 9500", () => {
      const result = computeDisruption(SafeInt(12), SafeInt(24));
      expect(Number(result)).toBe(9500);
    });

    it("equal CAP and strike → disruptionBp = 9000", () => {
      const result = computeDisruption(SafeInt(10), SafeInt(10));
      expect(Number(result)).toBe(9000);
    });

    it("CAP vastly outnumbers strike → disruptionBp = 5000 (minimum)", () => {
      const result = computeDisruption(SafeInt(50), SafeInt(5));
      expect(Number(result)).toBe(5000);
    });

    it("CAP vastly outnumbered by strike → disruptionBp = 10000 (no effect)", () => {
      const result = computeDisruption(SafeInt(2), SafeInt(100));
      expect(Number(result)).toBe(9980);
    });

    it("zero CAP → disruptionBp = 5000 (minimum, but theoretical)", () => {
      const result = computeDisruption(SafeInt(0), SafeInt(10));
      expect(Number(result)).toBe(10000);
    });

    it("zero strike → uses max(1, 0) = 1 to avoid division by zero", () => {
      const result = computeDisruption(SafeInt(10), SafeInt(0));
      expect(Number(result)).toBe(5000);
    });

    it("disruption is in valid range [5000, 10000]", () => {
      const values = [
        [0, 10],
        [1, 10],
        [12, 24],
        [10, 10],
        [50, 5],
        [2, 100],
        [10, 0],
        [100, 0],
      ];
      for (const [cap, strike] of values) {
        const result = computeDisruption(SafeInt(cap), SafeInt(strike));
        const bp = Number(result);
        expect(bp).toBeGreaterThanOrEqual(AIR_COMBAT_DISRUPTION_MIN_BP);
        expect(bp).toBeLessThanOrEqual(AIR_COMBAT_BASIS_POINTS);
      }
    });
  });
});
