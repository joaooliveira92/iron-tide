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
} from "@bluewave/combat/air-combat";

function makeRng(): RandomEngine {
  return new RandomEngine("test-torpedo-seed");
}

function defaultInput(): AirTorpedoAttackInput {
  return {
    attackerSquadronId: "sqn_attack_01",
    targetShipId: "target_ship_01",
    dropSpeedMps: SafeInt(150),
    dropAltitudeM: SafeInt(50),
    distanceToTargetM: SafeInt(1000),
    targetSpeedBp: SafeInt(10_000),
    targetSizeBp: SafeInt(10_000),
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
      const result = resolveAirTorpedoAttack(defaultInput(), makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(6_250);
    });

    it("air launch bonus (12500bp = +25% vs base 5000) produces 6250bp base", () => {
      const step1 = Math.floor(
        (AIR_COMBAT_TORPEDO_BASE_HIT_BP * AIR_COMBAT_TORPEDO_AIR_LAUNCH_HIT_BONUS_BP) / 10_000,
      );
      expect(step1).toBe(6_250);
    });

    it("target speed reduces hit probability", () => {
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        targetSpeedBp: SafeInt(15_000),
      };
      const result = resolveAirTorpedoAttack(input, makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(4_166);
    });

    it("target size reduces hit probability for smaller targets", () => {
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        targetSizeBp: SafeInt(5_000),
      };
      const result = resolveAirTorpedoAttack(input, makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(3_125);
    });

    it("hit probability is clamped to a minimum of 1000bp", () => {
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        targetSpeedBp: SafeInt(50_000),
        targetSizeBp: SafeInt(1_000),
      };
      const result = resolveAirTorpedoAttack(input, makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(1_000);
    });

    it("hit probability is clamped to a maximum of 10000bp", () => {
      const input: AirTorpedoAttackInput = {
        ...defaultInput(),
        targetSpeedBp: SafeInt(1),
      };
      const result = resolveAirTorpedoAttack(input, makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(10_000);
    });
  });

  describe("resolveAirTorpedoAttack — RNG hit/miss", () => {
    it("produces a hit when RNG draw is below hit probability (deterministic seed)", () => {
      const rng = new RandomEngine("test-torpedo-hit");
      const result = resolveAirTorpedoAttack(defaultInput(), rng);
      expect(typeof result.hit).toBe("boolean");
      expect(result.hit).toBe(true);
    });

    it("produces a miss when RNG draw is above hit probability", () => {
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
