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
      const result = computeExchange(defaultInput(), makeRng());
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
      expect(Number(result.factorContributions.numericalAdvantage)).toBe(10_000);
    });

    it("numerical disadvantage has 500 bp minimum floor", () => {
      const result = computeExchange(
        {
          ...defaultInput(),
          attackerCount: SafeInt(5),
          defenderCount: SafeInt(20),
          defenderToughness: SafeInt(0),
        },
        makeRng(),
      );
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
      expect(Number(result.losses)).toBeLessThanOrEqual(5);
      if (Number(result.rngDraw) < Number(result.killProbabilityBp)) {
        expect(Number(result.losses)).toBeGreaterThan(0);
      }
    });

    it("damaged is floor(losses * DESTROYED_DAMAGE_RATIO_BP / 10_000)", () => {
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
      expect(Number(index)).toBe(60);
    });

    it("returns 0 for all-zero scores", () => {
      const index = computeCombatIndex(SafeInt(0), SafeInt(0), SafeInt(0));
      expect(Number(index)).toBe(0);
    });

    it("returns 100 for max scores", () => {
      const index = computeCombatIndex(SafeInt(100), SafeInt(100), SafeInt(100));
      expect(Number(index)).toBe(100);
    });

    it("handles uneven division correctly (floor)", () => {
      expect(Number(computeCombatIndex(SafeInt(70), SafeInt(80), SafeInt(90)))).toBe(80);
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
      expect(Number(result)).toBe(9750);
    });
  });
});
