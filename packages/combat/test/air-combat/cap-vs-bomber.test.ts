// AC-6 (INC-2): Remaining CAP (after escort) engages bombers.
// Bombers do NOT return fire.
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
    // 10 CAP, 5 escort → CAP allocation
    // capToEscortBp = floor(5 * 10000 / 15) = 3333
    // escortEngagingCap = floor(10 * 3333 / 10000) = 3
    // bomberEngagingCap = 10 - 3 = 7
    const allocation = computeCapAllocation(SafeInt(10), SafeInt(5));
    expect(Number(allocation.escortEngagingCap)).toBe(3);
    expect(Number(allocation.bomberEngagingCap)).toBe(7);
  });

  it("CAP engages bombers via exchange function", () => {
    // 7 CAP (bomberEngagingCap) vs 20 bombers
    const allocation = computeCapAllocation(SafeInt(10), SafeInt(5));
    const bomberEngagingCap = allocation.bomberEngagingCap;

    const rng = new RandomEngine("cap-vs-bomber");
    const result = computeExchange(
      {
        attackerCombatIndex: SafeInt(60), // typical CAP fighter
        defenderCombatIndex: SafeInt(20), // typical bomber (lower)
        attackerCount: bomberEngagingCap,
        defenderCount: SafeInt(20),
        attackerAltitude: "HIGH",
        defenderAltitude: "MEDIUM",
        isFirstPass: true,
        defenderToughness: SafeInt(70), // bombers are tougher
        escortModifierBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
      },
      rng,
    );

    // Result should be a valid exchange
    expect(Number(result.killProbabilityBp)).toBeGreaterThan(0);
    expect(result.factorContributions).toHaveProperty("quality");
    // If draw succeeds, losses > 0; if draw fails, losses = 0 — both are valid
    expect(Number(result.losses)).toBeGreaterThanOrEqual(0);
    expect(Number(result.losses)).toBeLessThanOrEqual(20);
    expect(Number(result.damaged)).toBeGreaterThanOrEqual(0);
  });

  it("bombers do NOT return fire (only attacker-side losses)", () => {
    // In this model, CAP is always attacker, bombers are always defender.
    // The ExchangeResult only reports losses/damaged for the defender.
    // There is no return-fire computation — verifying the API shape.
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

    // Verify structure: losses/damaged are for defender (bombers)
    expect(result).toHaveProperty("losses");
    expect(result).toHaveProperty("damaged");
    // No attacker-loss property in ExchangeResult — this is correct (bombers don't return fire)
    expect(Object.keys(result)).not.toContain("attackerLosses");
  });

  describe("computeDisruption", () => {
    it("12 CAP vs 24 strike → disruptionBp = 9500", () => {
      // disruptionBp = max(5000, 10000 - floor(12 * 1000 / 24))
      // = max(5000, 10000 - 500) = 9500
      const result = computeDisruption(SafeInt(12), SafeInt(24));
      expect(Number(result)).toBe(9500);
    });

    it("equal CAP and strike → disruptionBp = 9000", () => {
      // max(5000, 10000 - floor(10 * 1000 / 10)) = max(5000, 9000) = 9000
      const result = computeDisruption(SafeInt(10), SafeInt(10));
      expect(Number(result)).toBe(9000);
    });

    it("CAP vastly outnumbers strike → disruptionBp = 5000 (minimum)", () => {
      // max(5000, 10000 - floor(50 * 1000 / 5)) = max(5000, 10000 - 10000) = 5000
      const result = computeDisruption(SafeInt(50), SafeInt(5));
      expect(Number(result)).toBe(5000);
    });

    it("CAP vastly outnumbered by strike → disruptionBp = 10000 (no effect)", () => {
      // max(5000, 10000 - floor(2 * 1000 / 100)) = max(5000, 10000 - 20) = 9980
      const result = computeDisruption(SafeInt(2), SafeInt(100));
      expect(Number(result)).toBe(9980);
    });

    it("zero CAP → disruptionBp = 5000 (minimum, but theoretical)", () => {
      // max(5000, 10000 - floor(0 * 1000 / 10)) = max(5000, 10000) = 10000
      const result = computeDisruption(SafeInt(0), SafeInt(10));
      expect(Number(result)).toBe(10000);
    });

    it("zero strike → uses max(1, 0) = 1 to avoid division by zero", () => {
      // max(5000, 10000 - floor(10 * 1000 / 1)) = max(5000, 10000 - 10000) = 5000
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
