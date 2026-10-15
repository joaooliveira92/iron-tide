/**
 * Coastline level-of-detail tiers for the Canvas map (ADR-0055). Tier 0 is the
 * coarsest, used when zoomed out; the last tier is the unsimplified 1:10m data.
 */

/** Douglas–Peucker tolerance in degrees; 0 means "use the source as is". */
export const COASTLINE_TIER_TOLERANCES: readonly number[] = [0.1, 0.02, 0];
export type CoastlineTier = 0 | 1 | 2;

const TIER_MIN_SCALE = [0, 3, 8] as const;

export function coastlineTierFor(scale: number): CoastlineTier {
  if (scale >= TIER_MIN_SCALE[2]) return 2;
  if (scale >= TIER_MIN_SCALE[1]) return 1;
  return 0;
}
