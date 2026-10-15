import { SafeInt } from "@bluewave/contracts";
import {
  LIGHT_JET_MIN_DISPLACEMENT_KG,
  LIGHT_JET_MIN_DISPLACEMENT_WITH_CATAPULT_KG,
  HEAVY_JET_MIN_DISPLACEMENT_KG,
  LIGHT_JET_TECHNOLOGY,
  HEAVY_JET_TECHNOLOGY,
  type JetCarrierCapability,
} from "./constants.js";

export interface JetCapabilityPredicates {
  trueStandardDisplacementKg: SafeInt;
  hasCompatibleOperationalSteamCatapult: boolean;
  hasAngledDeck: boolean;
  hasStrengthenedArrestingGear: boolean;
  hasJetCompatibleLiftsAndHangar: boolean;
  hasAdequateDeckStrengthAndHeatResistance: boolean;
  adoptedTechnologies: readonly string[];
}

export function determineJetCapability(predicates: JetCapabilityPredicates): JetCarrierCapability {
  if (isHeavyJetEligible(predicates)) return "MODERN_JET_CAPABLE";
  if (isHeavyJetCapable(predicates)) return "HEAVY_JET_CAPABLE";
  if (isLightJetEligible(predicates)) return "LIGHT_JET_CAPABLE";
  return "NONE";
}

export function isLightJetEligible(predicates: JetCapabilityPredicates): boolean {
  const displacement = Number(predicates.trueStandardDisplacementKg);

  if (displacement >= LIGHT_JET_MIN_DISPLACEMENT_KG) {
    return predicates.adoptedTechnologies.includes(LIGHT_JET_TECHNOLOGY);
  }

  if (
    displacement >= LIGHT_JET_MIN_DISPLACEMENT_WITH_CATAPULT_KG &&
    predicates.hasCompatibleOperationalSteamCatapult
  ) {
    return predicates.adoptedTechnologies.includes(LIGHT_JET_TECHNOLOGY);
  }

  return false;
}

function isHeavyJetCapable(predicates: JetCapabilityPredicates): boolean {
  const displacement = Number(predicates.trueStandardDisplacementKg);

  if (displacement < HEAVY_JET_MIN_DISPLACEMENT_KG) return false;
  if (!predicates.adoptedTechnologies.includes(HEAVY_JET_TECHNOLOGY)) return false;
  if (!predicates.hasCompatibleOperationalSteamCatapult) return false;
  if (!predicates.hasStrengthenedArrestingGear) return false;
  if (!predicates.hasJetCompatibleLiftsAndHangar) return false;
  if (!predicates.hasAdequateDeckStrengthAndHeatResistance) return false;

  return true;
}

function isHeavyJetEligible(predicates: JetCapabilityPredicates): boolean {
  if (!isHeavyJetCapable(predicates)) return false;
  if (!predicates.hasAngledDeck) return false;

  return true;
}
