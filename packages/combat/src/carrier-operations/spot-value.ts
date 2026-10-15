import { SafeInt } from "@bluewave/contracts";
import {
  CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT,
  SPOT_VALUE_DENOMINATOR,
  SPOT_CATAPULT_NONE_BP,
  SPOT_CATAPULT_ONE_BP,
  SPOT_CATAPULT_TWO_PLUS_BP,
  SPOT_SPEED_BELOW_20_BP,
  SPOT_SPEED_20_24_BP,
  SPOT_SPEED_24_28_BP,
  SPOT_SPEED_28_PLUS_BP,
  SPOT_DECK_STRAIGHT_BP,
  SPOT_DECK_EDGE_LIFT_BP,
  SPOT_DECK_ANGLED_BP,
  SPOT_DAMAGE_OPERATIONAL_BP,
  SPOT_DAMAGE_DEGRADED_BP,
  SPOT_DAMAGE_HEAVY_BP,
  SPOT_DAMAGE_INOPERABLE_BP,
  SPOT_TECH_BASIC_BP,
  SPOT_TECH_IMPROVED_BP,
  SPOT_TECH_MODERN_BP,
  OVERSIZED_CARRIER_THRESHOLD,
  OVERSIZED_DECK_CYCLE_EFFICIENCY_BP,
} from "./constants.js";
import type { CarrierOperationsState } from "./model.js";

export interface SpotMultiplierInputs {
  operationalCatapultCount: number;
  speedKnots: number;
  deckConfigurationId: string;
  flightDeckConditionBp: number;
  technologyLevel: string;
  compiledAircraftCapacity: number;
}

export function baseSpotValue(compiledAircraftCapacity: number): SafeInt {
  return SafeInt(Math.floor(compiledAircraftCapacity / 2));
}

function catapultMultiplierBp(operationalCatapultCount: number): number {
  if (operationalCatapultCount <= 0) return SPOT_CATAPULT_NONE_BP;
  if (operationalCatapultCount === 1) return SPOT_CATAPULT_ONE_BP;
  return SPOT_CATAPULT_TWO_PLUS_BP;
}

function speedMultiplierBp(speedKnots: number): number {
  if (speedKnots < 20) return SPOT_SPEED_BELOW_20_BP;
  if (speedKnots < 24) return SPOT_SPEED_20_24_BP;
  if (speedKnots < 28) return SPOT_SPEED_24_28_BP;
  return SPOT_SPEED_28_PLUS_BP;
}

function deckConfigurationMultiplierBp(deckConfigurationId: string): number {
  switch (deckConfigurationId) {
    case "straight_deck":
      return SPOT_DECK_STRAIGHT_BP;
    case "deck_edge_lift":
      return SPOT_DECK_EDGE_LIFT_BP;
    case "angled_deck":
      return SPOT_DECK_ANGLED_BP;
    default:
      return SPOT_DECK_STRAIGHT_BP;
  }
}

function flightDeckDamageMultiplierBp(flightDeckConditionBp: number): number {
  if (flightDeckConditionBp >= 10_000) return SPOT_DAMAGE_OPERATIONAL_BP;
  if (flightDeckConditionBp >= 7_500) return SPOT_DAMAGE_DEGRADED_BP;
  if (flightDeckConditionBp >= 3_500) return SPOT_DAMAGE_HEAVY_BP;
  return SPOT_DAMAGE_INOPERABLE_BP;
}

function technologyMultiplierBp(technologyLevel: string): number {
  switch (technologyLevel) {
    case "basic":
      return SPOT_TECH_BASIC_BP;
    case "improved":
      return SPOT_TECH_IMPROVED_BP;
    case "modern":
      return SPOT_TECH_MODERN_BP;
    default:
      return SPOT_TECH_BASIC_BP;
  }
}

function oversizedMultiplierBp(compiledAircraftCapacity: number): number {
  if (compiledAircraftCapacity > OVERSIZED_CARRIER_THRESHOLD) {
    return OVERSIZED_DECK_CYCLE_EFFICIENCY_BP;
  }
  return CARRIER_OPERATIONS_BASIS_POINTS_PER_UNIT;
}

export function computeFinalSpotValue(baseSpot: SafeInt, inputs: SpotMultiplierInputs): SafeInt {
  const product =
    BigInt(Number(baseSpot)) *
    BigInt(catapultMultiplierBp(inputs.operationalCatapultCount)) *
    BigInt(speedMultiplierBp(inputs.speedKnots)) *
    BigInt(deckConfigurationMultiplierBp(inputs.deckConfigurationId)) *
    BigInt(flightDeckDamageMultiplierBp(inputs.flightDeckConditionBp)) *
    BigInt(technologyMultiplierBp(inputs.technologyLevel)) *
    BigInt(oversizedMultiplierBp(inputs.compiledAircraftCapacity));

  const floored = Number(product / SPOT_VALUE_DENOMINATOR);
  const clamped = Math.max(0, Math.min(floored, inputs.compiledAircraftCapacity));
  return SafeInt(clamped);
}

export function computeFinalSpotValueFromState(state: CarrierOperationsState): SafeInt {
  const rawCapacity = Number(state.physicalCapacityUnits) / 2;
  const base = baseSpotValue(rawCapacity);
  const operationalCatapultCount = state.catapultDefinitions.filter(
    (c) => c.compatible && c.operational,
  ).length;
  return computeFinalSpotValue(base, {
    operationalCatapultCount,
    speedKnots: Number(state.weatherOperabilityState.windOverDeckKnots),
    deckConfigurationId: state.deckConfigurationId,
    flightDeckConditionBp: state.flightDeckCondition,
    technologyLevel: "basic",
    compiledAircraftCapacity: rawCapacity,
  });
}
