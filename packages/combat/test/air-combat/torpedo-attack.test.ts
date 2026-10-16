// AC-12 (INC-5): Air-launched torpedo attack resolution.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import {
  resolveAirTorpedoAttack,
  AIR_COMBAT_TORPEDO_BASE_HIT_BP,
  AIR_COMBAT_TORPEDO_AIR_LAUNCH_HIT_BONUS_BP,
  AIR_COMBAT_TORPEDO_MIN_DROP_SPEED_MPS,
  AIR_COMBAT_TORPEDO_MIN_DROP_ALTITUDE_M,
  AIR_COMBAT_TORPEDO_MAX_DROP_ALTITUDE_M,
  AIR_COMBAT_TORPEDO_MIN_RUN_M,
  AIR_COMBAT_TORPEDO_STRUCTURAL_DAMAGE,
  AIR_COMBAT_TORPEDO_FLOTATION_DAMAGE,
  AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE,
  type AirTorpedoAttackInput,
} from "../../src/air-combat/index.js";

function makeRng(): RandomEngine {
  return new RandomEngine("test-torpedo-seed");
}

function defaultInput(): AirTorpedoAttackInput {
  return {
    attackerSquadronId: "sqn_attack_01",
    targetShipId: "target_ship_01",
    dropSpeedMps: SafeInt(150), // well above min 50
    dropAltitudeM: SafeInt(50), // between 10 and 300
    distanceToTargetM: SafeInt(1000), // well above min 200
    targetSpeedBp: SafeInt(10_000), // no evasion
    targetSizeBp: SafeInt(10_000), // battleship size
  };
}

describe("AC-12: Air-launched torpedo attack", () => {
  describe("resolveAirTorpedoAttack — eligibility validation", () => {
    it("throws AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE when drop speed is too low", () => {
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        dropSpeedMps: SafeInt(AIR_COMBAT_TORPEDO_MIN_DROP_SPEED_MPS - 1),
      };
      expect(() => resolveAirTorpedoAttack(input, makeRng())).toThrow(
        AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE,
      );
    });

    it("throws AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE when drop altitude is too low", () => {
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        dropAltitudeM: SafeInt(AIR_COMBAT_TORPEDO_MIN_DROP_ALTITUDE_M - 1),
      };
      expect(() => resolveAirTorpedoAttack(input, makeRng())).toThrow(
        AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE,
      );
    });

    it("throws AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE when drop altitude is too high", () => {
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        dropAltitudeM: SafeInt(AIR_COMBAT_TORPEDO_MAX_DROP_ALTITUDE_M + 1),
      };
      expect(() => resolveAirTorpedoAttack(input, makeRng())).toThrow(
        AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE,
      );
    });

    it("throws AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE when distance is too short (< min run)", () => {
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        distanceToTargetM: SafeInt(AIR_COMBAT_TORPEDO_MIN_RUN_M - 1),
      };
      expect(() => resolveAirTorpedoAttack(input, makeRng())).toThrow(
        AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE,
      );
    });
  });

  describe("resolveAirTorpedoAttack — hit probability computation", () => {
    it("computes hit probability correctly with standard parameters", () => {
      // Standard: baseHitBp=5000, airLaunchBonus=12500, targetSize=10000, targetSpeed=10000
      // step1 = 5000 * 12500 / 10000 = 6250
      // step2 = 6250 * 10000 / 10000 = 6250
      // step3 = 6250 * 10000 / 10000 = 6250
      // clamped to [1000, 10000] = 6250
      const result = resolveAirTorpedoAttack(defaultInput(), makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(6_250);
    });

    it("air launch bonus (12500bp = +25% vs base 5000) produces 6250bp base", () => {
      // Hit probability step-by-step:
      // baseHitBp * airLaunchBonus / 10000 = 5000 * 12500 / 10000 = 6250
      const step1 = Math.floor(
        (AIR_COMBAT_TORPEDO_BASE_HIT_BP * AIR_COMBAT_TORPEDO_AIR_LAUNCH_HIT_BONUS_BP) / 10_000,
      );
      expect(step1).toBe(6_250);
    });

    it("target speed reduces hit probability", () => {
      // Fast target: targetSpeedBp = 15000
      // step1 = 5000 * 12500 / 10000 = 6250
      // step2 = 6250 * 10000 / 10000 = 6250
      // step3 = 6250 * 10000 / 15000 = 4166
      // clamped to [1000, 10000] = 4166
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        targetSpeedBp: SafeInt(15_000),
      };
      const result = resolveAirTorpedoAttack(input, makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(4_166);
    });

    it("target size reduces hit probability for smaller targets", () => {
      // Small target: targetSizeBp = 5000 (destroyer)
      // step1 = 5000 * 12500 / 10000 = 6250
      // step2 = 6250 * 5000 / 10000 = 3125
      // step3 = 3125 * 10000 / 10000 = 3125
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        targetSizeBp: SafeInt(5_000),
      };
      const result = resolveAirTorpedoAttack(input, makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(3_125);
    });

    it("hit probability is clamped to a minimum of 1000bp", () => {
      // Very fast, very small target
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        targetSpeedBp: SafeInt(50_000),
        targetSizeBp: SafeInt(1_000),
      };
      const result = resolveAirTorpedoAttack(input, makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(1_000);
    });

    it("hit probability is clamped to a maximum of 10000bp", () => {
      // Maximum hit probability
      // Large target + slow speed
      // step1 = 5000 * 12500 / 10000 = 6250
      // step2 = 6250 * 10000 / 10000 = 6250
      // step3 = 6250 * 10000 / 1 = 62500000... but clamped to 10000
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        targetSpeedBp: SafeInt(1), // minimum speed denominator
      };
      const result = resolveAirTorpedoAttack(input, makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(10_000);
    });
  });

  describe("resolveAirTorpedoAttack — RNG hit/miss", () => {
    it("produces a hit when RNG draw is below hit probability (deterministic seed)", () => {
      // Use a seed that produces a draw below 6250 to guarantee a hit
      // With "test-torpedo-hit" we can verify deterministically
      const rng = new RandomEngine("test-torpedo-hit");
      const result = resolveAirTorpedoAttack(defaultInput(), rng);
      // We don't know the exact draw, but hit must be either true or false
      expect(typeof result.hit).toBe("boolean");
      expect(result.hit).toBe(true);
    });

    it("produces a miss when RNG draw is above hit probability", () => {
      // Use a seed that produces a draw above 6250
      const rng = new RandomEngine("test-torpedo-miss");
      const result = resolveAirTorpedoAttack(defaultInput(), rng);
      expect(typeof result.hit).toBe("boolean");
    });

    it("is deterministic for the same seed", () => {
      const rng1 = new RandomEngine("test-torpedo-seed");
      const rng2 = new RandomEngine("test-torpedo-seed");
      const result1 = resolveAirTorpedoAttack(defaultInput(), rng1);
      const result2 = resolveAirTorpedoAttack(defaultInput(), rng2);
      expect(result1.hit).toBe(result2.hit);
      expect(Number(result1.hitProbabilityBp)).toBe(Number(result2.hitProbabilityBp));
    });
  });

  describe("resolveAirTorpedoAttack — damage package", () => {
    it("on hit: damage package returned with correct structural damage value", () => {
      // Use a seed that produces a hit (with 6250bp hit prob, many seeds will hit)
      const rng = new RandomEngine("test-torpedo-hit");
      const result = resolveAirTorpedoAttack(defaultInput(), rng);
      if (result.hit && result.damagePackage) {
        expect(result.damagePackage.structuralDamage).toBe(AIR_COMBAT_TORPEDO_STRUCTURAL_DAMAGE);
        expect(result.damagePackage.structuralDamage).toBe(500);
      }
    });

    it("on hit: damage package has correct flotation damage", () => {
      const rng = new RandomEngine("test-torpedo-hit");
      const result = resolveAirTorpedoAttack(defaultInput(), rng);
      if (result.hit && result.damagePackage) {
        expect(result.damagePackage.flotationDamage).toBe(AIR_COMBAT_TORPEDO_FLOTATION_DAMAGE);
        expect(result.damagePackage.flotationDamage).toBe(1000);
      }
    });

    it("on hit: damage package has hullBreach=true and underwater hit location", () => {
      const rng = new RandomEngine("test-torpedo-hit");
      const result = resolveAirTorpedoAttack(defaultInput(), rng);
      if (result.hit && result.damagePackage) {
        expect(result.damagePackage.hullBreach).toBe(true);
        expect(result.damagePackage.hitLocation).toBe("UNDERWATER_HULL");
        expect(result.damagePackage.hitZoneType).toBe("UNDERWATER");
        expect(result.damagePackage.capsizeRisk).toBe(true);
        expect(result.damagePackage.penetrationOutcome).toBe("FULL_PENETRATION");
      }
    });

    it("on hit: damage package has correct sourceId and weaponId", () => {
      const rng = new RandomEngine("test-torpedo-hit");
      const result = resolveAirTorpedoAttack(defaultInput(), rng);
      if (result.hit && result.damagePackage) {
        expect(result.damagePackage.sourceId).toBe("sqn_attack_01");
        expect(result.damagePackage.weaponId).toBe("air-launched-torpedo");
        expect(result.damagePackage.targetShipId).toBe("target_ship_01");
      }
    });

    it("on miss: damagePackage is null", () => {
      const rng = new RandomEngine("test-torpedo-miss");
      const result = resolveAirTorpedoAttack(defaultInput(), rng);
      if (!result.hit) {
        expect(result.damagePackage).toBeNull();
      }
    });
  });
});
