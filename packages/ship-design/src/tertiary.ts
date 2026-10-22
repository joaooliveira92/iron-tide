export interface TertiaryBattery {
  readonly caliberUm: number;
  readonly count: number;
}

export interface TertiaryBalance {
  readonly gunWeightNanoKgPerMm3: number;
  readonly footprintFactorPermille: number;
  readonly shellNanoKgPerMm3: number;
  readonly bearingBp: number;
}

export interface TertiaryExpansion {
  readonly guns: number;
  readonly weightKg: number;
  readonly footprintMm2: number;
  readonly broadsideKg: number;
}

export const TERTIARY_ZONE = "SUPERSTRUCTURE" as const;
export const TERTIARY_STATION_PERMILLE = 500;

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
