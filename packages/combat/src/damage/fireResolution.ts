import { type FireRecord } from "./state.js";
import {
  FIRE_ROF_PENALTY_BANDS,
  FIRE_NIGHT_SIGNATURE_BANDS,
  FIRE_SMOKE_FUEL_MULTIPLIERS,
  FIRE_DEFAULT_VENTILATION_MULTIPLIER_BP,
  FIRE_DEFAULT_FUEL_MULTIPLIER_BP,
  FIRE_SPREAD_BASE_PROBABILITY_BP,
  FIRE_INTENSITY_DECAY_PER_MINUTE,
  FIRE_SPREAD_BASE_INTENSITY_BP,
} from "./fireConstants.js";
import { getFireRiskBp } from "./immediateFireFlooding.js";
import { FIRE_SPREAD_CREATED } from "./reasonCodes.js";

function lookupBand(
  intensityBp: number,
  bands: ReadonlyArray<{
    minIntensity: number;
    maxIntensity: number;
    multiplierBp: number;
  }>,
): number {
  for (const band of bands) {
    if (intensityBp >= band.minIntensity && intensityBp <= band.maxIntensity) {
      return band.multiplierBp;
    }
  }
  return 10_000;
}

function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

function clampBp(value: number): number {
  if (value < 0) return 0;
  if (value > 10_000) return 10_000;
  return value;
}

export function getFireRofPenaltyBp(intensityBp: number): number {
  return lookupBand(intensityBp, FIRE_ROF_PENALTY_BANDS);
}

export function getFireNightSignatureBp(intensityBp: number): number {
  return lookupBand(intensityBp, FIRE_NIGHT_SIGNATURE_BANDS);
}

export function computeFireSmokeStrength(
  fireIntensityBp: number,
  fuelClass: string,
  ventilationMultiplierBp?: number,
): number {
  const fuelMultiplierBp =
    FIRE_SMOKE_FUEL_MULTIPLIERS[fuelClass] ?? FIRE_DEFAULT_FUEL_MULTIPLIER_BP;
  const ventMultiplierBp = ventilationMultiplierBp ?? FIRE_DEFAULT_VENTILATION_MULTIPLIER_BP;
  const numerator = fireIntensityBp * fuelMultiplierBp * ventMultiplierBp;
  return floorDiv(numerator, 10_000 * 10_000);
}

export function resolveFireProgression(
  fireRecords: readonly FireRecord[],
  shipType: string,
  keyedRng: ((stream: string) => number) | null,
): { fireRecords: readonly FireRecord[]; newFires: readonly FireRecord[] } {
  const decayed: FireRecord[] = [];

  for (const fire of fireRecords) {
    const newIntensity = fire.intensityBp - FIRE_INTENSITY_DECAY_PER_MINUTE;
    if (newIntensity >= 1) {
      decayed.push({
        ...fire,
        intensityBp: newIntensity,
      });
    }
  }

  const newFires: FireRecord[] = [];

  if (keyedRng !== null) {
    const fireRiskBp = getFireRiskBp(shipType);
    const spreadChanceBp = floorDiv(fireRiskBp * FIRE_SPREAD_BASE_PROBABILITY_BP, 10_000);
    const clampedSpreadChanceBp = clampBp(spreadChanceBp);

    for (const fire of decayed) {
      if (fire.cause === FIRE_SPREAD_CREATED) continue;
      const draw = keyedRng(`battle/ship/damage/fire_spread/${fire.locationId}`);
      const drawBp = Math.floor(draw * 10_000);

      if (drawBp < clampedSpreadChanceBp) {
        const spreadLocationId = `${fire.locationId}_adj`;
        newFires.push({
          locationId: spreadLocationId,
          intensityBp: FIRE_SPREAD_BASE_INTENSITY_BP,
          cause: FIRE_SPREAD_CREATED,
        });
      }
    }
  }

  return {
    fireRecords: decayed,
    newFires,
  };
}
