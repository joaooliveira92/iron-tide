import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { type RandomEngine, drawUniform } from "@bluewave/random";
import {
  AIR_COMBAT_TORPEDO_BASE_HIT_BP,
  AIR_COMBAT_TORPEDO_AIR_LAUNCH_HIT_BONUS_BP,
  AIR_COMBAT_BASIS_POINTS,
  AIR_COMBAT_TORPEDO_MIN_DROP_SPEED_MPS,
  AIR_COMBAT_TORPEDO_MIN_DROP_ALTITUDE_M,
  AIR_COMBAT_TORPEDO_MAX_DROP_ALTITUDE_M,
  AIR_COMBAT_TORPEDO_MIN_RUN_M,
  AIR_COMBAT_TORPEDO_STRUCTURAL_DAMAGE,
  AIR_COMBAT_TORPEDO_FLOTATION_DAMAGE,
} from "./constants.js";
import { AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE } from "./reasonCodes.js";
import type { GunneryImpact } from "../damage/engineWiring.js";

export interface AirTorpedoAttackInput {
  attackerSquadronId: string;
  targetShipId: string;
  dropSpeedMps: SafeInt;
  dropAltitudeM: SafeInt;
  distanceToTargetM: SafeInt;
  targetSpeedBp: SafeInt;
  targetSizeBp: SafeInt;
}

export interface AirTorpedoAttackResult {
  hit: boolean;
  hitProbabilityBp: SafeInt;
  damagePackage: GunneryImpact | null;
}

export function resolveAirTorpedoAttack(
  input: AirTorpedoAttackInput,
  rngEngine: RandomEngine,
): AirTorpedoAttackResult {
  const dropSpeedMps = Number(input.dropSpeedMps);
  const dropAltitudeM = Number(input.dropAltitudeM);
  const distanceM = Number(input.distanceToTargetM);

  if (dropSpeedMps < AIR_COMBAT_TORPEDO_MIN_DROP_SPEED_MPS) {
    throw new BluewaveError(AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE, {
      code: AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE,
      field: "dropSpeedMps",
      value: dropSpeedMps,
      min: AIR_COMBAT_TORPEDO_MIN_DROP_SPEED_MPS,
      reason: `drop speed ${dropSpeedMps} mps is below minimum ${AIR_COMBAT_TORPEDO_MIN_DROP_SPEED_MPS} mps`,
    });
  }

  if (dropAltitudeM < AIR_COMBAT_TORPEDO_MIN_DROP_ALTITUDE_M) {
    throw new BluewaveError(AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE, {
      code: AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE,
      field: "dropAltitudeM",
      value: dropAltitudeM,
      min: AIR_COMBAT_TORPEDO_MIN_DROP_ALTITUDE_M,
      reason: `drop altitude ${dropAltitudeM}m is below minimum ${AIR_COMBAT_TORPEDO_MIN_DROP_ALTITUDE_M}m`,
    });
  }

  if (dropAltitudeM > AIR_COMBAT_TORPEDO_MAX_DROP_ALTITUDE_M) {
    throw new BluewaveError(AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE, {
      code: AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE,
      field: "dropAltitudeM",
      value: dropAltitudeM,
      max: AIR_COMBAT_TORPEDO_MAX_DROP_ALTITUDE_M,
      reason: `drop altitude ${dropAltitudeM}m exceeds maximum ${AIR_COMBAT_TORPEDO_MAX_DROP_ALTITUDE_M}m`,
    });
  }

  if (distanceM < AIR_COMBAT_TORPEDO_MIN_RUN_M) {
    throw new BluewaveError(AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE, {
      code: AIR_COMBAT_TORPEDO_ATTACK_INELIGIBLE,
      field: "distanceToTargetM",
      value: distanceM,
      min: AIR_COMBAT_TORPEDO_MIN_RUN_M,
      reason: `distance ${distanceM}m is below minimum run ${AIR_COMBAT_TORPEDO_MIN_RUN_M}m`,
    });
  }

  const baseHitBp = SafeInt(AIR_COMBAT_TORPEDO_BASE_HIT_BP);
  const airLaunchBonus = SafeInt(AIR_COMBAT_TORPEDO_AIR_LAUNCH_HIT_BONUS_BP);
  const basisPoints = SafeInt(AIR_COMBAT_BASIS_POINTS);

  const temp1 = SafeInt.mul(baseHitBp, airLaunchBonus);
  const step1 = SafeInt.div(temp1, basisPoints, "floor");

  const temp2 = SafeInt.mul(step1, input.targetSizeBp);
  const step2 = SafeInt.div(temp2, basisPoints, "floor");

  const speedDenom = Number(input.targetSpeedBp) < 1 ? SafeInt.ONE : input.targetSpeedBp;
  const temp3 = SafeInt.mul(step2, basisPoints);
  const step3 = SafeInt.div(temp3, speedDenom, "floor");

  const rawHitProb = Number(step3);
  const clampedHitProb = SafeInt(Math.max(1_000, Math.min(AIR_COMBAT_BASIS_POINTS, rawHitProb)));

  const stream = rngEngine.stream("air-combat/torpedo-attack");
  const draw = drawUniform(stream, SafeInt.ZERO, SafeInt(AIR_COMBAT_BASIS_POINTS - 1));

  const isHit = Number(draw) < Number(clampedHitProb);

  let damagePackage: GunneryImpact | null = null;

  if (isHit) {
    damagePackage = {
      sourceId: input.attackerSquadronId,
      weaponId: "air-launched-torpedo",
      targetShipId: input.targetShipId,
      hitLocation: "UNDERWATER_HULL",
      penetrationOutcome: "FULL_PENETRATION",
      splinterIntensity: "HEAVY",
      effectiveResistanceUm: 0,
      penetrationMargin: 1000,
      structuralDamage: Number(AIR_COMBAT_TORPEDO_STRUCTURAL_DAMAGE),
      flotationDamage: Number(AIR_COMBAT_TORPEDO_FLOTATION_DAMAGE),
      shipType: "ORDINARY",
      hasCombustible: false,
      hasOxygen: false,
      hullBreach: true,
      hasWaterRoute: true,
      hasMagazineInZone: false,
      hitZoneType: "UNDERWATER",
      catastrophicBreakup: false,
      capsizeRisk: true,
      designFlotationReserve: 10_000,
      designStabilityScore: 5_000,
    };
  }

  return {
    hit: isHit,
    hitProbabilityBp: clampedHitProb,
    damagePackage,
  };
}
