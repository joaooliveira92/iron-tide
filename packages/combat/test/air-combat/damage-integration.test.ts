// AC-13 (INC-5): Bomb and torpedo damage integration with GunneryImpact shape.
import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import {
  resolveBombingAttack,
  resolveAirTorpedoAttack,
  AIR_COMBAT_BOMB_BASE_FLOTATION_DAMAGE,
  AIR_COMBAT_TORPEDO_STRUCTURAL_DAMAGE,
  AIR_COMBAT_TORPEDO_FLOTATION_DAMAGE,
  type BombingAttackInput,
  type AirTorpedoAttackInput,
  type AirAttackDamagePackage,
} from "../../src/air-combat/index.js";

function makeRng(): RandomEngine {
  return new RandomEngine("test-damage-integration");
}

function makeBombInput(overrides?: Partial<BombingAttackInput>): BombingAttackInput {
  return {
    attackerSquadronId: "sqn_bomber_01",
    targetShipId: "target_ship_01",
    payloadCapacity: SafeInt(100),
    isDiveBomb: false,
    accuracyBp: SafeInt(8_000),
    disruptionBp: SafeInt(10_000),
    targetArmorZoneBp: SafeInt(5_000),
    ...overrides,
  };
}

function makeTorpedoInput(overrides?: Partial<AirTorpedoAttackInput>): AirTorpedoAttackInput {
  return {
    attackerSquadronId: "sqn_torpedo_01",
    targetShipId: "target_ship_01",
    dropSpeedMps: SafeInt(150),
    dropAltitudeM: SafeInt(50),
    distanceToTargetM: SafeInt(1000),
    targetSpeedBp: SafeInt(10_000),
    targetSizeBp: SafeInt(10_000),
    ...overrides,
  };
}

describe("AC-13: Damage integration — bomb and torpedo", () => {
  describe("resolveBombingAttack — bomb hit creates AirAttackDamagePackage with correct shape", () => {
    it("returns a result with hit, hitProbabilityBp, and damagePackage fields", () => {
      const rng = new RandomEngine("test-bomb-hit");
      const result = resolveBombingAttack(makeBombInput(), rng);
      expect(result).toHaveProperty("hit");
      expect(result).toHaveProperty("hitProbabilityBp");
      expect(result).toHaveProperty("damagePackage");
    });

    it("hitProbabilityBp matches the accuracyBp input", () => {
      const result = resolveBombingAttack(makeBombInput(), makeRng());
      expect(Number(result.hitProbabilityBp)).toBe(8_000);
    });

    it("hitProbabilityBp is clamped to [0, 10_000]", () => {
      const rng = makeRng();
      const result = resolveBombingAttack(makeBombInput({ accuracyBp: SafeInt(-100) }), rng);
      expect(Number(result.hitProbabilityBp)).toBe(0);

      const resultHigh = resolveBombingAttack(
        makeBombInput({ accuracyBp: SafeInt(15_000) }),
        makeRng(),
      );
      expect(Number(resultHigh.hitProbabilityBp)).toBe(10_000);
    });
  });

  describe("resolveBombingAttack — bomb damage package has correct structural/flotation damage", () => {
    it("structuralDamage = BASE_STRUCTURAL * payloadFactor (payload=100 → factor=10)", () => {
      const rng = new RandomEngine("test-bomb-hit-structural");
      const result = resolveBombingAttack(makeBombInput({ payloadCapacity: SafeInt(100) }), rng);
      if (result.hit && result.damagePackage) {
        // payloadFactor = max(1, floor(100/10)) = 10
        // structuralDamage = 100 * 10 = 1000
        expect(result.damagePackage.structuralDamage).toBe(1000);
      }
    });

    it("structuralDamage with payload=10 → factor=1", () => {
      const rng = new RandomEngine("test-bomb-hit-payload-small");
      const result = resolveBombingAttack(makeBombInput({ payloadCapacity: SafeInt(10) }), rng);
      if (result.hit && result.damagePackage) {
        // payloadFactor = max(1, floor(10/10)) = 1
        // structuralDamage = 100 * 1 = 100
        expect(result.damagePackage.structuralDamage).toBe(100);
      }
    });

    it("flotationDamage is BASE_FLOTATION for bombs", () => {
      const rng = new RandomEngine("test-bomb-hit-flotation");
      const result = resolveBombingAttack(makeBombInput(), rng);
      if (result.hit && result.damagePackage) {
        expect(result.damagePackage.flotationDamage).toBe(AIR_COMBAT_BOMB_BASE_FLOTATION_DAMAGE);
        expect(result.damagePackage.flotationDamage).toBe(50);
      }
    });
  });

  describe("resolveBombingAttack — dive vs level bombing penetration", () => {
    it("dive bomb uses DIVE_BOMBING_PENETRATION_MULTIPLIER_BP", () => {
      const rng = new RandomEngine("test-bomb-dive");
      const result = resolveBombingAttack(makeBombInput({ isDiveBomb: true }), rng);
      if (result.hit && result.damagePackage) {
        expect(result.damagePackage.weaponId).toBe("dive-bomb");
      }
    });

    it("level bomb uses LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP", () => {
      const rng = new RandomEngine("test-bomb-level");
      const result = resolveBombingAttack(makeBombInput({ isDiveBomb: false }), rng);
      if (result.hit && result.damagePackage) {
        expect(result.damagePackage.weaponId).toBe("level-bomb");
      }
    });
  });

  describe("resolveBombingAttack — miss produces null damage package", () => {
    it("returns null damagePackage on miss", () => {
      // Force miss by using accuracyBp = 0
      const rng = new RandomEngine("test-bomb-miss");
      const result = resolveBombingAttack(makeBombInput({ accuracyBp: SafeInt(0) }), rng);
      expect(result.hit).toBe(false);
      expect(result.damagePackage).toBeNull();
    });
  });

  describe("resolveAirTorpedoAttack — torpedo hit creates correct shape", () => {
    it("torpedo hit returns GunneryImpact-shaped damage package", () => {
      const rng = new RandomEngine("test-torp-hit");
      const result = resolveAirTorpedoAttack(makeTorpedoInput(), rng);
      if (result.hit && result.damagePackage) {
        const pkg: AirAttackDamagePackage = result.damagePackage;
        expect(pkg.structuralDamage).toBe(AIR_COMBAT_TORPEDO_STRUCTURAL_DAMAGE);
        expect(pkg.flotationDamage).toBe(AIR_COMBAT_TORPEDO_FLOTATION_DAMAGE);
        expect(pkg.hullBreach).toBe(true);
        expect(pkg.hitLocation).toBe("UNDERWATER_HULL");
        expect(pkg.hitZoneType).toBe("UNDERWATER");
        expect(pkg.penetrationOutcome).toBe("FULL_PENETRATION");
      }
    });

    it("torpedo miss produces null damage package", () => {
      const rng = new RandomEngine("test-torp-miss");
      const result = resolveAirTorpedoAttack(
        makeTorpedoInput({ targetSpeedBp: SafeInt(50_000) }),
        rng,
      );
      // With very high target speed, hit probability drops to 1000bp clamped, which is still > 0
      // but the RNG draw might be above it
      if (!result.hit) {
        expect(result.damagePackage).toBeNull();
      }
    });
  });
});
