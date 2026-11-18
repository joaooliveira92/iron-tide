import type { GunneryImpact } from "../damage/engineWiring.js";
import { FLOAT_UNIT, STABILITY_INITIAL_BP } from "../damage/minuteDamageConstants.js";
import type { CollisionRules } from "./model.js";

export const COLLISION_WEAPON_ID = "COLLISION" as const;
export const COLLISION_HIT_LOCATION = "HULL" as const;

export function buildCollisionImpact(
  rules: CollisionRules,
  sourceId: string,
  targetShipId: string,
  closingSpeedMps: number,
): GunneryImpact {
  const structuralDamage = rules.structuralBase + rules.structuralPerMps * closingSpeedMps;
  const flotationDamage = rules.flotationBase + rules.flotationPerMps * closingSpeedMps;
  return {
    sourceId,
    weaponId: COLLISION_WEAPON_ID,
    targetShipId,
    hitLocation: COLLISION_HIT_LOCATION,
    penetrationOutcome: "NO_EFFECT",
    splinterIntensity: "NONE",
    effectiveResistanceUm: 0,
    penetrationMargin: 0,
    structuralDamage,
    flotationDamage,
    shipType: "ORDINARY",
    hasCombustible: false,
    hasOxygen: false,
    hullBreach: false,
    hasWaterRoute: false,
    hasMagazineInZone: false,
    hitZoneType: COLLISION_HIT_LOCATION,
    catastrophicBreakup: false,
    capsizeRisk: false,
    designFlotationReserve: FLOAT_UNIT,
    designStabilityScore: STABILITY_INITIAL_BP,
  };
}
