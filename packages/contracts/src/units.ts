import type { Brand } from "./index.js";

export type Kg = Brand<number, "Kg">;
export type Um = Brand<number, "Um">;
export type UmPerSec = Brand<number, "UmPerSec">;
export type Litre = Brand<number, "Litre">;
export type Kw = Brand<number, "Kw">;
export type Bp = Brand<number, "Bp">;
export type Money = Brand<number, "TreasuryUnit">;

export const BP_ONE = 10_000;
export const MM_TO_UM = 1_000;
export const KNOTS_TO_UMS = 514_444;
export const UM_PER_INCH = 25_400;
export const UM_PER_KNOT = KNOTS_TO_UMS;

export class UnitError extends Error {
  readonly _tag = "UnitError";
  constructor(
    readonly unit: string,
    readonly value: number,
    reason: string,
  ) {
    super(`${unit}: ${reason} (${value})`);
    this.name = "UnitError";
  }
}

function checked<B extends number>(unit: string, value: number, min: number): B {
  if (!Number.isSafeInteger(value)) throw new UnitError(unit, value, "must be a safe integer");
  if (value < min) throw new UnitError(unit, value, `must be >= ${min}`);
  return value as B;
}

export const kg = (v: number): Kg => checked<Kg>("Kg", v, 0);
export const um = (v: number): Um => checked<Um>("Um", v, 0);
export const umPerSec = (v: number): UmPerSec => checked<UmPerSec>("UmPerSec", v, 0);
export const litre = (v: number): Litre => checked<Litre>("Litre", v, 0);
export const kw = (v: number): Kw => checked<Kw>("Kw", v, 0);
export const money = (v: number): Money =>
  checked<Money>("TreasuryUnit", v, Number.MIN_SAFE_INTEGER);
export const bp = (v: number): Bp => checked<Bp>("Bp", v, Number.MIN_SAFE_INTEGER);

export function isUnitError(value: unknown): value is UnitError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly _tag?: unknown })._tag === "UnitError"
  );
}

export const knotsToUmPerSec = (knots: number): UmPerSec => umPerSec(knots * KNOTS_TO_UMS);

export const mmToUm = (mm: number): Um => um(mm * MM_TO_UM);

export function mulBp(value: number, factor: number): number {
  const num = BigInt(value) * BigInt(factor);
  const d = BigInt(BP_ONE);
  const q = (2n * num + d) / (2n * d);
  const adj = num < 0n && (2n * num + d) % (2n * d) !== 0n ? q - 1n : q;
  return toSafe("mulBp", adj);
}

export function ceilDiv(a: number, b: number): number {
  if (b <= 0) throw new UnitError("ceilDiv", b, "divisor must be > 0");
  return toSafe("ceilDiv", (BigInt(a) + BigInt(b) - 1n) / BigInt(b));
}

export function toSafe(label: string, v: bigint): number {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new UnitError(label, Number(v), "result outside safe integer range");
  }
  return Number(v);
}
