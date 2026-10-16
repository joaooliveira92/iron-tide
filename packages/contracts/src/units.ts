import type { Brand } from "./index.js";

/**
 * One canonical unit per quantity, declared once (ADR-0202, map D2). Authoring
 * units (millimetres, knots, inches) and display units are **not** canonical:
 * authoring conversion happens once at the content-compile boundary, display
 * conversion only at the presentation boundary (map D6).
 *
 * Every branded type is a safe integer; every constructor rejects a
 * non-integer, an unsafe integer, or a value below the quantity's minimum with a
 * `_tag`-discriminated {@link UnitError}, and never returns `NaN`/`Infinity`.
 * The module is runtime-free: no Node, filesystem, `Intl`, `Date`, locale, clock
 * or float arithmetic.
 */
export type Kg = Brand<number, "Kg">;
export type Um = Brand<number, "Um">;
export type UmPerSec = Brand<number, "UmPerSec">;
export type Litre = Brand<number, "Litre">;
export type Kw = Brand<number, "Kw">;
export type Bp = Brand<number, "Bp">;
/** Canonical money: an integer in treasury units (1 unit = GBP 10,000; map D3). */
export type Money = Brand<number, "TreasuryUnit">;

/** Basis points in one whole: `10_000 bp = 100 %`. */
export const BP_ONE = 10_000;
/** Micrometres in one millimetre. */
export const MM_TO_UM = 1_000;
/** Micrometres per second in one knot (1 kt = 0.514444 m/s). */
export const KNOTS_TO_UMS = 514_444;
/** Micrometres in one inch (the content compiler's imperial authoring unit). */
export const UM_PER_INCH = 25_400;
/** Alias of {@link KNOTS_TO_UMS} (the ship-design convention). */
export const UM_PER_KNOT = KNOTS_TO_UMS;

export class UnitError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
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
/** Canonical money is signed: the treasury and ledger model deficits (map D3). */
export const money = (v: number): Money =>
  checked<Money>("TreasuryUnit", v, Number.MIN_SAFE_INTEGER);
/** Basis points may be negative (modifiers); `10_000 bp = 100 %`. */
export const bp = (v: number): Bp => checked<Bp>("Bp", v, Number.MIN_SAFE_INTEGER);

/** `_tag`-based narrowing for a thrown value (RULES.md "Errors": discriminate by `_tag`). */
export function isUnitError(value: unknown): value is UnitError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly _tag?: unknown })._tag === "UnitError"
  );
}

/** Convert an authored design value in knots to canonical micrometres per second. */
export const knotsToUmPerSec = (knots: number): UmPerSec => umPerSec(knots * KNOTS_TO_UMS);

/** Convert an authored design value in millimetres to canonical micrometres. */
export const mmToUm = (mm: number): Um => um(mm * MM_TO_UM);

/** `value * bp / 10_000`, rounded half up (toward +inf on ties); bigint intermediate, rounded once. */
export function mulBp(value: number, factor: number): number {
  const num = BigInt(value) * BigInt(factor);
  const d = BigInt(BP_ONE);
  const q = (2n * num + d) / (2n * d);
  // floor division for negative products
  const adj = num < 0n && (2n * num + d) % (2n * d) !== 0n ? q - 1n : q;
  return toSafe("mulBp", adj);
}

/** `ceil(a / b)` for a positive divisor; throws {@link UnitError} on a non-positive divisor. */
export function ceilDiv(a: number, b: number): number {
  if (b <= 0) throw new UnitError("ceilDiv", b, "divisor must be > 0");
  return toSafe("ceilDiv", (BigInt(a) + BigInt(b) - 1n) / BigInt(b));
}

/** Narrow a bigint intermediate to a safe number, throwing {@link UnitError} outside the safe range. */
export function toSafe(label: string, v: bigint): number {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new UnitError(label, Number(v), "result outside safe integer range");
  }
  return Number(v);
}
