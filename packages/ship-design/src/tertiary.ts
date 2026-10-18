/**
 * The tertiary battery (ADR-0233, manual p.28): a count of one chosen gun with no per-mount placement, no fire arc and
 * no role. The compile expands it deterministically into the three things it contributes: weight, deck footprint (the
 * topside it occupies) and a bearing share of broadside shell mass. Integer arithmetic throughout; every coefficient
 * is a BALANCE TARGET (ADR-0213) authored in the ruleset, never sourced.
 */

export interface TertiaryBattery {
  /** Bore, micrometres. */
  readonly caliberUm: number;
  readonly count: number;
}

export interface TertiaryBalance {
  /** Gun and mount weight, nano-kg per mm^3 of bore cube (bore^3 x this / 1e9 = kg). */
  readonly gunWeightNanoKgPerMm3: number;
  /** Deck footprint, permille of the bore square (bore^2 x this / 1000 = mm^2), crew space included. */
  readonly footprintFactorPermille: number;
  /** Shell mass, nano-kg per mm^3 of bore cube. */
  readonly shellNanoKgPerMm3: number;
  /** Share of the guns that bear on one beam, bp. */
  readonly bearingBp: number;
}

export interface TertiaryExpansion {
  readonly guns: number;
  readonly weightKg: number;
  readonly footprintMm2: number;
  /** Shell mass of the battery's contribution to one broadside, kg. */
  readonly broadsideKg: number;
}

/** The battery has no placement; for the topside and the stability lump it sits amidships on the weather deck. */
export const TERTIARY_ZONE = "SUPERSTRUCTURE" as const;
export const TERTIARY_STATION_PERMILLE = 500;

/** Used when the ruleset authors no tertiary coefficients: the battery then contributes nothing. */
export const NO_TERTIARY_BALANCE: TertiaryBalance = {
  gunWeightNanoKgPerMm3: 0,
  footprintFactorPermille: 0,
  shellNanoKgPerMm3: 0,
  bearingBp: 0,
};

const NONE: TertiaryExpansion = { guns: 0, weightKg: 0, footprintMm2: 0, broadsideKg: 0 };
const UM3_PER_MM3 = 1_000_000_000n;
const NANO = 1_000_000_000n;
const UM2_PER_MM2 = 1_000_000n;
const BP = 10_000n;

export function expandTertiary(
  t: TertiaryBattery | undefined,
  b: TertiaryBalance,
): TertiaryExpansion {
  if (t === undefined) return NONE;
  if (!Number.isSafeInteger(t.caliberUm) || t.caliberUm <= 0)
    throw new Error(`tertiary caliberUm must be a positive integer, got ${t.caliberUm}`);
  if (!Number.isSafeInteger(t.count) || t.count < 0)
    throw new Error(`tertiary count must be a non-negative integer, got ${t.count}`);
  if (t.count === 0) return NONE;
  const n = BigInt(t.count);
  const cube = BigInt(t.caliberUm) ** 3n;
  const square = BigInt(t.caliberUm) ** 2n;
  const den = UM3_PER_MM3 * NANO;
  const perGunWeight = (cube * BigInt(b.gunWeightNanoKgPerMm3) + den - 1n) / den;
  const perGunFootprint = (square * BigInt(b.footprintFactorPermille)) / (UM2_PER_MM2 * 1000n);
  return {
    guns: t.count,
    weightKg: Number(n * perGunWeight),
    footprintMm2: Number(n * perGunFootprint),
    broadsideKg: Number(
      (n * cube * BigInt(b.shellNanoKgPerMm3) * BigInt(b.bearingBp)) / (den * BP),
    ),
  };
}
