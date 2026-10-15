// DESIGN-41 §22-28 — Per-minute fire resolution functions.
// These handle fire state progression between damage-resolution events:
//   - Intensity decay (suppression/self-decay)
//   - Fire extinguishment at intensity < 1
//   - Fire spread to adjacent compartments
//   - Rate-of-fire penalty computation
//   - Night signature computation
//   - Fire smoke strength computation
//
// Pure/deterministic: uses keyed RNG function when provided, no ambient I/O/clock/random.

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

/**
 * Look up the multiplier bp for a given intensity value from a band array.
 * Bands are assumed to be non-overlapping and sorted in ascending intensity order.
 * Returns 10_000 (no effect) if no band matches (e.g. intensity is 0 or out of range).
 */
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

/**
 * Compute integer floor division: Math.floor(a / b).
 * Equivalent to (a / b) | 0 for non-negative a, but written explicitly for clarity.
 */
function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/**
 * Clamp a value to [0, 10_000].
 */
function clampBp(value: number): number {
  if (value < 0) return 0;
  if (value > 10_000) return 10_000;
  return value;
}

/**
 * Get rate-of-fire penalty multiplier for a given fire intensity (DESIGN-41 §22).
 * Returns multiplier in basis points [0, 10_000].
 *
 * Higher intensity fires impose a greater ROF penalty (lower multiplier).
 * Intensity 0 returns 10_000 bp (no penalty).
 *
 * @param intensityBp - Fire intensity in basis points [0, 10_000].
 * @returns Multiplier in basis points.
 */
export function getFireRofPenaltyBp(intensityBp: number): number {
  return lookupBand(intensityBp, FIRE_ROF_PENALTY_BANDS);
}

/**
 * Get night signature multiplier for a given fire intensity (DESIGN-41 §24).
 * Returns multiplier in basis points [0, 10_000].
 *
 * Higher intensity fires produce a greater night signature (higher multiplier).
 * Intensity 0 returns 10_000 bp (base visibility).
 *
 * @param intensityBp - Fire intensity in basis points [0, 10_000].
 * @returns Multiplier in basis points.
 */
export function getFireNightSignatureBp(intensityBp: number): number {
  return lookupBand(intensityBp, FIRE_NIGHT_SIGNATURE_BANDS);
}

/**
 * Compute fire smoke production (DESIGN-41 §25).
 *
 * smokeStrength = floor(fireIntensity × smokeFuelMultiplierBp × ventilationMultiplierBp / 10_000²)
 *
 * The smoke fuel multiplier is looked up from FIRE_SMOKE_FUEL_MULTIPLIERS by fuel class.
 * Unknown fuel classes use FIRE_DEFAULT_FUEL_MULTIPLIER_BP (8_000 bp).
 *
 * @param fireIntensityBp - Fire intensity in basis points [0, 10_000].
 * @param fuelClass - Fuel class identifier (e.g. "ORDINARY", "OIL", "COAL", "MIXED").
 * @param ventilationMultiplierBp - Optional ventilation multiplier (defaults to 10_000 bp).
 * @returns Smoke strength (integer, non-negative).
 */
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

/**
 * Resolve one minute of fire progression for a list of fire records.
 *
 * For each fire:
 * 1. Decay intensity by FIRE_INTENSITY_DECAY_PER_MINUTE (simulating suppression/self-decay)
 * 2. Remove fires with intensity < 1 (extinguished)
 * 3. Check for spread to adjacent compartments using keyed RNG when available
 *
 * @param fireRecords - The current list of active fire records.
 * @param shipType - Ship type classification for fire-risk multiplier lookup.
 * @param keyedRng - Deterministic RNG function keyed by stream name, or null to skip randomness.
 * @returns Updated fire records plus any new fires created by spread.
 */
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
    // Fires with intensity < 1 are removed (extinguished)
  }

  const newFires: FireRecord[] = [];

  if (keyedRng !== null) {
    const fireRiskBp = getFireRiskBp(shipType);
    // spreadChanceBp = fireRiskBp × FIRE_SPREAD_BASE_PROBABILITY_BP / 10_000
    const spreadChanceBp = floorDiv(fireRiskBp * FIRE_SPREAD_BASE_PROBABILITY_BP, 10_000);
    const clampedSpreadChanceBp = clampBp(spreadChanceBp);

    for (const fire of decayed) {
      // Bound spread to a single hop: a fire that was itself created by spread
      // does not spread again. Without this, the synthetic `${locationId}_adj`
      // chain (`BELT -> BELT_adj -> BELT_adj_adj -> ...`) grows without bound
      // across a long battle (a latent blow-up only reachable once the corrected
      // caliber scale lets a battle run to the minute cap — ADR-0094). One hop
      // per originating fire keeps the active-fire set bounded by the real
      // compartments; the single-hop behaviour the fire-resolution tests pin is
      // unchanged.
      if (fire.cause === FIRE_SPREAD_CREATED) continue;
      const draw = keyedRng(`battle/ship/damage/fire_spread/${fire.locationId}`);
      const drawBp = Math.floor(draw * 10_000);

      if (drawBp < clampedSpreadChanceBp) {
        // Fire spreads to adjacent compartment (simplified: locationId + "_adj")
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
