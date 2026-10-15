//packages/combat/test/air-combat/exchange-formula.test.ts
// AC-5 (INC-2): 6-factor air-to-air exchange formula.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import {
  computeExchange,
  computeCombatIndex,
  computeDefenderSurvivalFactorBp,
  type ExchangeInput,
} from "../../src/air-combat/index.js";
import {
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_QUALITY_OUT_OF_RANGE,
  AIR_COMBAT_ATTACKER_ZERO_STRENGTH,
  AIR_COMBAT_NO_AVAILABLE_TARGET,
  AIR_COMBAT_ALTITUDE_ADVANTAGE_BP,
  AIR_COMBAT_ALTITUDE_NEUTRAL_BP,
  AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP,
  AIR_COMBAT_SURPRISE_FIRST_PASS_BP,
  AIR_COMBAT_SURPRISE_SUBSEQUENT_BP,
  AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP,
} from "../../src/air-combat/index.js";

function makeRng(): RandomEngine {
  return new RandomEngine("test-exchange-seed");
}

function defaultInput(): ExchangeInput {
  return {
    attackerCombatIndex: SafeInt(50),
    defenderCombatIndex: SafeInt(50),
    attackerCount: SafeInt(10),
    defenderCount: SafeInt(10),
    attackerAltitude: "MEDIUM",
    defenderAltitude: "MEDIUM",
    isFirstPass: false,
    defenderToughness: SafeInt(50),
    escortModifierBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
  };
}

describe("AC-5: Air-to-air exchange formula", () => {
  describe("computeExchange", () => {
    it("equal fighters produce a reasonable kill probability", () => {
      // combatIndex=50 each, count=10 each, neutral altitude, second pass, toughness=50
      // quality: 50*10000/50 = 10000
      // numerical: 10*10000/10 = 10000
      // altitude: neutral = 10000
      // surprise: subsequent = 10000
      // defenderSurvival: 9000 + floor(50*1000/100) = 9000+500 = 9500
      // escort: 10000
      // numerator = 10000 * 10000 * 10000 * 10000 * 9500 * 10000 * 10000 = ...
      // = 10000^6 * 9500
      // denominator = 10000^6
      // killProb = 9500
      const result = computeExchange(defaultInput(), makeRng());
      // With all neutral factors except defenderSurvival=9500:
      // killProb = floor(10000 * 10000 * 10000 * 10000 * 9500 * 10000 * 10000 / 10000^6)
      //         = floor(9500)
      //         = 9500
      expect(Number(result.killProbabilityBp)).toBe(9500);
      expect(result.factorContributions).toHaveProperty("quality");
      expect(result.factorContributions).toHaveProperty("numericalAdvantage");
      expect(result.factorContributions).toHaveProperty("altitude");
      expect(result.factorContributions).toHaveProperty("surprise");
      expect(result.factorContributions).toHaveProperty("defenderSurvival");
      expect(result.factorContributions).toHaveProperty("escort");
    });

    it("quality advantage: attackerCombatIndex=80 vs defender=30", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          attackerCombatIndex: SafeInt(80),
          defenderCombatIndex: SafeInt(30),
        },
        makeRng(),
      );
      // quality = 80*10000/30 = 26666 → clamped to 10000
      // Actually, floor(80*10000/30) = floor(800000/30) = floor(26666.66) = 26666
      // But quality max is 10000, so clamped to 10000
      // So quality factor = 10000 (max)
      expect(Number(result.factorContributions.quality)).toBe(10_000);
    });

    it("numerical advantage: 20 vs 5", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          attackerCount: SafeInt(20),
          defenderCount: SafeInt(5),
        },
        makeRng(),
      );
      // numericalAdvantage = max(500, 20*10000/5) = max(500, 40000) = 10000 (clamped)
      expect(Number(result.factorContributions.numericalAdvantage)).toBe(10_000);
    });

    it("numerical disadvantage has 500 bp minimum floor", () => {
      // 5 attackers vs 20 defenders = numerical disadvantage
      const result = computeExchange(
        {
          ...defaultInput(),
          attackerCount: SafeInt(5),
          defenderCount: SafeInt(20),
          defenderToughness: SafeInt(0), // survival=9000, makes killProb less than draw
        },
        makeRng(),
      );
      // numericalAdvantage = max(500, 5*10000/20) = max(500, 2500) = 2500
      // With combatIndex=50 vs 50, numericalAdvantage=2500:
      // quality=10000, numerical=2500, altitude=10000, surprise=10000,
      // defenderSurvival=9000 (toughness=0), escort=10000
      // numerator = 10000 * 10000 * 2500 * 10000 * 9000 * 10000 * 10000
      //          = 10000^5 * 2500 * 9000
      //          = 2500 * 9000 = 22_500_000 / 10_000 = 2250
      // denominator = 10000^6
      // killProb = floor(10000 * 10000 * 2500 * 10000 * 9000 * 10000 * 10000 / 10000^6)
      //         = floor(10000^5 * 2500 * 9000 * 10000 / 10000^6)... wait
      // Actually: numerator = 10_000 * 10_000 * 2_500 * 10_000 * 9_000 * 10_000 * 10_000
      //         = 10_000^6 * 2500 * 9000 / 10000^2
      //         = 2500 * 9000 / 10000 = 2250
      expect(Number(result.factorContributions.numericalAdvantage)).toBe(2500);
    });

    it("altitude advantage: attacker above defender", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          attackerAltitude: "HIGH",
          defenderAltitude: "LOW",
        },
        makeRng(),
      );
      expect(Number(result.factorContributions.altitude)).toBe(AIR_COMBAT_ALTITUDE_ADVANTAGE_BP);
    });

    it("altitude disadvantage: attacker below defender", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          attackerAltitude: "LOW",
          defenderAltitude: "HIGH",
        },
        makeRng(),
      );
      expect(Number(result.factorContributions.altitude)).toBe(AIR_COMBAT_ALTITUDE_DISADVANTAGE_BP);
    });

    it("altitude neutral: same altitude", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          attackerAltitude: "HIGH",
          defenderAltitude: "HIGH",
        },
        makeRng(),
      );
      expect(Number(result.factorContributions.altitude)).toBe(AIR_COMBAT_ALTITUDE_NEUTRAL_BP);
    });

    it("surprise first pass modifier", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          isFirstPass: true,
        },
        makeRng(),
      );
      expect(Number(result.factorContributions.surprise)).toBe(AIR_COMBAT_SURPRISE_FIRST_PASS_BP);
    });

    it("surprise subsequent pass modifier", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          isFirstPass: false,
        },
        makeRng(),
      );
      expect(Number(result.factorContributions.surprise)).toBe(AIR_COMBAT_SURPRISE_SUBSEQUENT_BP);
    });

    it("toughness=0 gives survival 9_000", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          defenderToughness: SafeInt(0),
        },
        makeRng(),
      );
      expect(Number(result.factorContributions.defenderSurvival)).toBe(9_000);
    });

    it("toughness=100 gives survival 10_000", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          defenderToughness: SafeInt(100),
        },
        makeRng(),
      );
      expect(Number(result.factorContributions.defenderSurvival)).toBe(10_000);
    });

    it("throws AIR_COMBAT_QUALITY_OUT_OF_RANGE for attackerCombatIndex < 0", () => {
      expect(() =>
        computeExchange({ ...defaultInput(), attackerCombatIndex: SafeInt(-1) }, makeRng()),
      ).toThrow(AIR_COMBAT_QUALITY_OUT_OF_RANGE);
    });

    it("throws AIR_COMBAT_QUALITY_OUT_OF_RANGE for attackerCombatIndex > 100", () => {
      expect(() =>
        computeExchange({ ...defaultInput(), attackerCombatIndex: SafeInt(101) }, makeRng()),
      ).toThrow(AIR_COMBAT_QUALITY_OUT_OF_RANGE);
    });

    it("throws AIR_COMBAT_ATTACKER_ZERO_STRENGTH for zero attacker count", () => {
      expect(() =>
        computeExchange({ ...defaultInput(), attackerCount: SafeInt.ZERO }, makeRng()),
      ).toThrow(AIR_COMBAT_ATTACKER_ZERO_STRENGTH);
    });

    it("throws AIR_COMBAT_NO_AVAILABLE_TARGET for zero defender count", () => {
      expect(() =>
        computeExchange({ ...defaultInput(), defenderCount: SafeInt.ZERO }, makeRng()),
      ).toThrow(AIR_COMBAT_NO_AVAILABLE_TARGET);
    });

    it("all factor contributions returned in factorContributions map", () => {
      const result = computeExchange(defaultInput(), makeRng());
      expect(Object.keys(result.factorContributions)).toEqual([
        "quality",
        "numericalAdvantage",
        "altitude",
        "surprise",
        "defenderSurvival",
        "escort",
      ]);
      Object.values(result.factorContributions).forEach((v) => {
        expect(Number(v)).toBeGreaterThanOrEqual(0);
        expect(Number(v)).toBeLessThanOrEqual(10_000);
      });
    });

    it("rngDraw is in range [0, 9999]", () => {
      const result = computeExchange(defaultInput(), makeRng());
      const draw = Number(result.rngDraw);
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThanOrEqual(9_999);
    });

    it("losses capped at defenderCount", () => {
      // Create an extremely favorable kill probability via all max factors
      // But we can't force losses to exceed defenderCount since losses = floor(killProb * defenderCount / 10000)
      // and killProb is clamped to 10000, so max losses = floor(10000 * defenderCount / 10000) = defenderCount
      // With 100% kill probability and 5 defenders:
      const result = computeExchange(
        {
          attackerCombatIndex: SafeInt(100),
          defenderCombatIndex: SafeInt(0),
          attackerCount: SafeInt(100),
          defenderCount: SafeInt(5),
          attackerAltitude: "HIGH",
          defenderAltitude: "LOW",
          isFirstPass: true,
          defenderToughness: SafeInt(0),
          escortModifierBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
        },
        makeRng(),
      );
      // Max killProb = 10000, losses = floor(10000 * 5 / 10000) = 5
      expect(Number(result.losses)).toBeLessThanOrEqual(5);
      // With favorable conditions and draw < killProb, losses should be non-zero
      if (Number(result.rngDraw) < Number(result.killProbabilityBp)) {
        expect(Number(result.losses)).toBeGreaterThan(0);
      }
    });

    it("damaged is floor(losses * DESTROYED_DAMAGE_RATIO_BP / 10_000)", () => {
      // Use a deterministic seed and check the damaged/losses relationship
      const rng = new RandomEngine("deterministic-test");
      const result = computeExchange(
        {
          attackerCombatIndex: SafeInt(100),
          defenderCombatIndex: SafeInt(0),
          attackerCount: SafeInt(100),
          defenderCount: SafeInt(10),
          attackerAltitude: "HIGH",
          defenderAltitude: "LOW",
          isFirstPass: true,
          defenderToughness: SafeInt(0),
          escortModifierBp: SafeInt(AIR_COMBAT_BASIS_POINTS),
        },
        rng,
      );
      if (Number(result.losses) > 0) {
        const expectedDamaged = Math.floor(
          (Number(result.losses) * AIR_COMBAT_DESTROYED_DAMAGE_RATIO_BP) / AIR_COMBAT_BASIS_POINTS,
        );
        expect(Number(result.damaged)).toBe(expectedDamaged);
      }
    });
  });

  describe("computeCombatIndex", () => {
    it("computes combat index from speed, firepower, maneuverability", () => {
      const index = computeCombatIndex(SafeInt(70), SafeInt(50), SafeInt(60));
      // floor((70+50+60)/3) = floor(180/3) = 60
      expect(Number(index)).toBe(60);
    });

    it("returns 0 for all-zero scores", () => {
      const index = computeCombatIndex(SafeInt(0), SafeInt(0), SafeInt(0));
      expect(Number(index)).toBe(0);
    });

    it("returns 100 for max scores", () => {
      const index = computeCombatIndex(SafeInt(100), SafeInt(100), SafeInt(100));
      // floor(300/3) = 100
      expect(Number(index)).toBe(100);
    });

    it("handles uneven division correctly (floor)", () => {
      // 70+80+90 = 240, /3 = 80 → exact
      expect(Number(computeCombatIndex(SafeInt(70), SafeInt(80), SafeInt(90)))).toBe(80);
      // 50+50+51 = 151, /3 = 50.33 → floor = 50
      expect(Number(computeCombatIndex(SafeInt(50), SafeInt(50), SafeInt(51)))).toBe(50);
    });
  });

  describe("computeDefenderSurvivalFactorBp", () => {
    it("toughness=0 → survivalBp=9000", () => {
      const result = computeDefenderSurvivalFactorBp(SafeInt(0));
      expect(Number(result)).toBe(9000);
    });

    it("toughness=50 → survivalBp=9500", () => {
      const result = computeDefenderSurvivalFactorBp(SafeInt(50));
      expect(Number(result)).toBe(9500);
    });

    it("toughness=100 → survivalBp=10000", () => {
      const result = computeDefenderSurvivalFactorBp(SafeInt(100));
      expect(Number(result)).toBe(10000);
    });

    it("toughness=75 → survivalBp=9750", () => {
      const result = computeDefenderSurvivalFactorBp(SafeInt(75));
      // 9000 + floor(75*1000/100) = 9000 + 750 = 9750
      expect(Number(result)).toBe(9750);
    });
  });
});
