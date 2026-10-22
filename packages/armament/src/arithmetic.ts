import { BluewaveError } from "@bluewave/contracts";

export const ARMAMENT_BP_ONE = 10_000 as const;

export function isSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value);
}

function toSafeInt(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new BluewaveError("armament arithmetic overflow", { label, value: value.toString() });
  }
  return Number(value);
}

export function composeBpMultipliers(factors: readonly number[]): number {
  if (factors.length === 0) return ARMAMENT_BP_ONE;
  let numerator = 1n;
  for (const factor of factors) {
    if (!Number.isSafeInteger(factor) || factor < 0) {
      throw new BluewaveError("armament basis-point factor must be a non-negative safe integer", {
        factor,
      });
    }
    numerator *= BigInt(factor);
  }
  const denominator = BigInt(ARMAMENT_BP_ONE) ** BigInt(factors.length - 1);
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  return toSafeInt(rounded, "composeBpMultipliers");
}

export function scaleByBp(value: number, factorBp: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BluewaveError("armament scale value must be a non-negative safe integer", { value });
  }
  if (!Number.isSafeInteger(factorBp) || factorBp < 0) {
    throw new BluewaveError("armament scale factor must be a non-negative safe integer", {
      factorBp,
    });
  }
  const numerator = BigInt(value) * BigInt(factorBp);
  const denominator = BigInt(ARMAMENT_BP_ONE);
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  return toSafeInt(rounded, "scaleByBp");
}
