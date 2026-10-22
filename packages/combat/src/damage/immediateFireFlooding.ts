import { FIRE_SOURCE_CREATED, FLOODING_SOURCE_CREATED } from "./reasonCodes.js";
import type { FireSourceRecord, FloodingSourceRecord } from "./state.js";

export const SHIP_TYPE_FIRE_RISK_BP: Record<string, number> = {
  ORDINARY: 10_000,
  CARRIER: 15_000,
  PRE_DREADNOUGHT: 12_000,
  BATTLE_CRUISER: 10_000,
  DESTROYER: 8_000,
  CRUISER: 9_000,
};

const DEFAULT_FIRE_RISK_BP = 10_000;

const BASE_FIRE_INTENSITY_BP = 5_000;

const BASE_FLOODING_RATE_KG_MIN = 800;

const IGNITION_OUTCOMES = new Set(["FULL_PENETRATION", "CRITICAL_PENETRATION"]);

const FLOODING_CHANCE_BP: Record<string, number> = {
  FULL_PENETRATION: 8_000,
  PARTIAL_PENETRATION: 3_000,
};

export interface FireCreationInput {
  locationId: string;
  penetrationOutcome: string;
  hitZoneType: string;
  shipType: string;
  hasCombustible: boolean;
  hasOxygen: boolean;
}

export interface FloodingCreationInput {
  compartmentId: string;
  penetrationOutcome: string;
  hullBreach: boolean;
  hasWaterRoute: boolean;
}

export type { FireSourceRecord, FloodingSourceRecord };

export function getFireRiskBp(shipType: string): number {
  return SHIP_TYPE_FIRE_RISK_BP[shipType] ?? DEFAULT_FIRE_RISK_BP;
}

export function evaluateFireCreation(
  input: FireCreationInput,
  keyedRng: (stream: string) => number,
): FireSourceRecord | null {
  const { locationId, penetrationOutcome, shipType, hasCombustible, hasOxygen } = input;

  if (!IGNITION_OUTCOMES.has(penetrationOutcome)) {
    return null;
  }

  if (!hasCombustible) {
    return null;
  }

  if (!hasOxygen) {
    return null;
  }

  const fireRiskBp = getFireRiskBp(shipType);

  const draw = keyedRng("battle/ship/damage/fire_creation");
  const drawBp = Math.floor(draw * 10_000);

  if (drawBp >= fireRiskBp) {
    return null;
  }

  return {
    locationId,
    intensityBp: BASE_FIRE_INTENSITY_BP,
    cause: FIRE_SOURCE_CREATED,
  };
}

export function evaluateFloodingCreation(
  input: FloodingCreationInput,
  keyedRng: (stream: string) => number,
): FloodingSourceRecord | null {
  const { compartmentId, penetrationOutcome, hullBreach, hasWaterRoute } = input;

  if (!hullBreach) {
    return null;
  }

  const floodingChanceBp = FLOODING_CHANCE_BP[penetrationOutcome];
  if (floodingChanceBp === undefined) {
    return null;
  }

  if (!hasWaterRoute) {
    return null;
  }

  const draw = keyedRng("battle/ship/damage/flooding_creation");
  const drawBp = Math.floor(draw * 10_000);

  if (drawBp >= floodingChanceBp) {
    return null;
  }

  return {
    compartmentId,
    rateKgMin: BASE_FLOODING_RATE_KG_MIN,
    cause: FLOODING_SOURCE_CREATED,
  };
}
