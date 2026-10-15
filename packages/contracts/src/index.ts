export type Brand<Base, BrandTag extends string> = Base & { readonly __brand: BrandTag };

export type SafeInt = Brand<number, "SafeInt">;

export function SafeInt(value: number): SafeInt {
  if (!Number.isInteger(value)) {
    throw new BluewaveError("SafeInt must be an integer", { value });
  }
  if (value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER) {
    throw new BluewaveError("SafeInt must be a safe integer", { value });
  }
  return value as SafeInt;
}

export namespace SafeInt {
  export function isSafeInt(value: number): value is SafeInt {
    return (
      Number.isInteger(value) &&
      value >= Number.MIN_SAFE_INTEGER &&
      value <= Number.MAX_SAFE_INTEGER
    );
  }

  export const ZERO = 0 as SafeInt;
  export const ONE = 1 as SafeInt;

  export function add(a: SafeInt, b: SafeInt): SafeInt {
    const result = a + b;
    return SafeInt(result);
  }

  export function sub(a: SafeInt, b: SafeInt): SafeInt {
    const result = a - b;
    return SafeInt(result);
  }

  export function mul(a: SafeInt, b: SafeInt): SafeInt {
    const result = a * b;
    if (!Number.isSafeInteger(result)) {
      throw new BluewaveError("SafeInt multiplication overflow", { a, b, result });
    }
    return result as SafeInt;
  }

  export function div(a: SafeInt, b: SafeInt, rounding: RoundingMode = "trunc"): SafeInt {
    if (b === (0 as SafeInt)) {
      throw new BluewaveError("SafeInt division by zero", { a, b });
    }
    const exact = a / b;
    const rounded = roundResult(exact, rounding);
    return SafeInt(rounded);
  }
}

export class BluewaveError extends Error {
  /**
   * Stable discriminator (RULES.md "Errors"): callers recover by `_tag`, never
   * `instanceof`. `contracts` is renderer-reachable, so the class stays plain
   * TypeScript with a `readonly _tag` field rather than a `Data.TaggedError`
   * (which would risk bundling the `effect` runtime into the renderer;
   * MIG-EXCL-1, ADR-0128 §1).
   */
  readonly _tag = "BluewaveError";
  constructor(
    message: string,
    public readonly context: Record<string, unknown>,
  ) {
    super(message);
    this.name = "BluewaveError";
  }
}

/**
 * `_tag`-based narrowing for an unknown thrown value (RULES.md "Errors":
 * discriminate with `_tag`, never `instanceof`). A plain TS guard, not an
 * Effect failure-channel helper.
 */
export function isBluewaveError(value: unknown): value is BluewaveError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly _tag?: unknown })._tag === "BluewaveError"
  );
}

export type RoundingMode = "trunc" | "floor" | "ceil" | "halfUp" | "halfDown" | "halfEven";

function roundResult(value: number, mode: RoundingMode): number {
  switch (mode) {
    case "trunc":
      return value < 0 ? Math.ceil(value) : Math.floor(value);
    case "floor":
      return Math.floor(value);
    case "ceil":
      return Math.ceil(value);
    case "halfUp": {
      const sign = value < 0 ? -1 : 1;
      const abs = Math.abs(value);
      const floored = Math.floor(abs);
      if (abs - floored >= 0.5) return sign * (floored + 1);
      return sign * floored;
    }
    case "halfDown": {
      const sign = value < 0 ? -1 : 1;
      const abs = Math.abs(value);
      const floored = Math.floor(abs);
      if (abs - floored > 0.5) return sign * (floored + 1);
      return sign * floored;
    }
    case "halfEven": {
      const sign = value < 0 ? -1 : 1;
      const abs = Math.abs(value);
      const floored = Math.floor(abs);
      const frac = abs - floored;
      if (frac === 0.5) {
        if (floored % 2 !== 0) return sign * (floored + 1);
        return sign * floored;
      }
      if (frac > 0.5) return sign * (floored + 1);
      return sign * floored;
    }
  }
}

export function checkedAdd(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(result)) {
    throw new BluewaveError("Checked addition overflow", { a, b, result });
  }
  return result;
}

export function checkedSub(a: number, b: number): number {
  const result = a - b;
  if (!Number.isSafeInteger(result)) {
    throw new BluewaveError("Checked subtraction overflow", { a, b, result });
  }
  return result;
}

export function checkedMul(a: number, b: number): number {
  const result = a * b;
  if (!Number.isSafeInteger(result)) {
    throw new BluewaveError("Checked multiplication overflow", { a, b, result });
  }
  return result;
}

export function roundToInt(value: number, mode: RoundingMode): number {
  const rounded = roundResult(value, mode);
  if (!Number.isSafeInteger(rounded)) {
    throw new BluewaveError("Rounding produced unsafe integer", { value, mode, rounded });
  }
  return rounded;
}
