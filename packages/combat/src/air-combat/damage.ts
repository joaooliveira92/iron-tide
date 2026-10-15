//packages/combat/src/air-combat/damage.ts
// D-3 M4 Aviation: CAP & Strikes — INC-5 (AC-13): bomb damage resolution.
// Simplified bomb damage package creation for the damage pipeline.
// Pure deterministic functions — no I/O, no Date.
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

// ---- AirAttackDamagePackage ----
// Reuses the GunneryImpact interface from damage pipeline.
// This type alias makes the semantic intent clear.
export type AirAttackDamagePackage = GunneryImpact;

// ---- BombingAttackInput ----

export interface BombingAttackInput {
  attackerSquadronId: string;
  targetShipId: string;
  payloadCapacity: SafeInt; // from aircraft model
  isDiveBomb: boolean;
  accuracyBp: SafeInt; // from computeBombingAccuracy
  disruptionBp: SafeInt; // current disruption
  targetArmorZoneBp: SafeInt; // target armor effectiveness
}

// ---- BombingAttackResult ----

export interface BombingAttackResult {
  hit: boolean;
  hitProbabilityBp: SafeInt;
  damagePackage: AirAttackDamagePackage | null;
}

// ---- resolveBombingAttack ----

/**
 * Resolves a bombing attack against a surface target.
 *
 * 1. Hit probability = accuracyBp (from computeBombingAccuracy), clamped [0, 10_000].
 * 2. RNG draw to determine hit/miss.
 * 3. On hit: constructs a GunneryImpact damage package.
 *
 * Bomb damage:
 * - structuralDamage = AIR_COMBAT_BOMB_BASE_STRUCTURAL_DAMAGE * payloadFactor
 * - payloadFactor = max(1, payloadCapacity / 10)
 * - flotationDamage = AIR_COMBAT_BOMB_BASE_FLOTATION_DAMAGE (bombs cause less flotation damage)
 * - Penetration: dive bombs use AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP
 *
 * @param input - Bombing attack input parameters.
 * @param rngEngine - RandomEngine for keyed RNG draw (domain: "air-combat/bombing-attack").
 * @returns BombingAttackResult with hit status and damage package.
 */
export function resolveBombingAttack(
  input: BombingAttackInput,
  rngEngine: RandomEngine,
): BombingAttackResult {
  // ---- Hit probability ----
  const rawAccuracyBp = Number(input.accuracyBp);
  const hitProbabilityBp = SafeInt(Math.max(0, Math.min(AIR_COMBAT_BASIS_POINTS, rawAccuracyBp)));

  // ---- RNG draw ----
  const stream = rngEngine.stream("air-combat/bombing-attack");
  const draw = drawUniform(stream, SafeInt.ZERO, SafeInt(AIR_COMBAT_BASIS_POINTS - 1));

  const isHit = Number(draw) < Number(hitProbabilityBp);

  // ---- Damage package on hit ----
  let damagePackage: AirAttackDamagePackage | null = null;

  if (isHit) {
    // Payload factor: structural damage scales with payload
    const payloadCapacity = Number(input.payloadCapacity);
    const payloadFactor = Math.max(1, Math.floor(payloadCapacity / 10));

    const structuralDamage = AIR_COMBAT_BOMB_BASE_STRUCTURAL_DAMAGE * payloadFactor;
    const flotationDamage = AIR_COMBAT_BOMB_BASE_FLOTATION_DAMAGE;

    // Penetration multiplier
    const penetrationMultiplierBp = input.isDiveBomb
      ? AIR_COMBAT_DIVE_BOMBING_PENETRATION_MULTIPLIER_BP
      : AIR_COMBAT_LEVEL_BOMBING_PENETRATION_MULTIPLIER_BP;

    // Effective resistance: target armor * penetration multiplier (inverse)
    // Higher penetration multiplier = easier to penetrate = lower effective resistance
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
