import { type RandomEngine, drawUniform } from "@bluewave/random";
import { SafeInt } from "@bluewave/contracts";
import {
  AIR_COMBAT_BOMB_BASE_STRUCTURAL_DAMAGE,
  AIR_COMBAT_BOMB_BASE_FLOTATION_DAMAGE,
  AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP,
  AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP,
  AIR_COMBAT_BASIS_POINTS,
} from "./constants.js";
import type { GunneryImpact } from "../damage/engineWiring.js";

export type AirAttackDamagePackage = GunneryImpact;

export interface BombingAttackInput {
  attackerSquadronId: string;
  targetShipId: string;
  payloadCapacity: SafeInt;
  isDiveBomb: boolean;
  accuracyBp: SafeInt;
  disruptionBp: SafeInt;
  targetArmorZoneBp: SafeInt;
}

export interface BombingAttackResult {
  hit: boolean;
  hitProbabilityBp: SafeInt;
  damagePackage: AirAttackDamagePackage | null;
}

export function resolveBombingAttack(
  input: BombingAttackInput,
  rngEngine: RandomEngine,
): BombingAttackResult {
  const rawAccuracyBp = Number(input.accuracyBp);
  const hitProbabilityBp = SafeInt(Math.max(0, Math.min(AIR_COMBAT_BASIS_POINTS, rawAccuracyBp)));

  const stream = rngEngine.stream("air-combat/bombing-attack");
  const draw = drawUniform(stream, SafeInt.ZERO, SafeInt(AIR_COMBAT_BASIS_POINTS - 1));

  const isHit = Number(draw) < Number(hitProbabilityBp);

  let damagePackage: AirAttackDamagePackage | null = null;

  if (isHit) {
    const payloadCapacity = Number(input.payloadCapacity);
    const payloadFactor = Math.max(1, Math.floor(payloadCapacity / 10));

    const structuralDamage = AIR_COMBAT_BOMB_BASE_STRUCTURAL_DAMAGE * payloadFactor;
    const flotationDamage = AIR_COMBAT_BOMB_BASE_FLOTATION_DAMAGE;

    const penetrationMultiplierBp = input.isDiveBomb
      ? AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP
      : AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP;

    const effectiveResistanceUm = Math.floor(
      (Number(input.targetArmorZoneBp) * AIR_COMBAT_BASIS_POINTS) /
        Math.max(1, penetrationMultiplierBp),
    );

    damagePackage = {
      sourceId: input.attackerSquadronId,
      weaponId: input.isDiveBomb ? "dive-bomb" : "level-bomb",
      targetShipId: input.targetShipId,
      hitLocation: "DECK_HIT",
      penetrationOutcome:
        penetrationMultiplierBp >= 10_000 ? "FULL_PENETRATION" : "PARTIAL_PENETRATION",
      splinterIntensity: "MEDIUM",
      effectiveResistanceUm,
      penetrationMargin: 500 - effectiveResistanceUm,
      structuralDamage,
      flotationDamage,
      shipType: "ORDINARY",
      hasCombustible: true,
      hasOxygen: true,
      hullBreach: false,
      hasWaterRoute: false,
      hasMagazineInZone: false,
      hitZoneType: "DECK",
      catastrophicBreakup: false,
      capsizeRisk: false,
      designFlotationReserve: 10_000,
      designStabilityScore: 5_000,
    };
  }

  return {
    hit: isHit,
    hitProbabilityBp,
    damagePackage,
  };
}
