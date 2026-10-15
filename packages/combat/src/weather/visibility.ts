//packages/combat/src/weather/visibility.ts
// DESIGN-42 §5 visibility distance (INC-3/AC-6): exact integer formula
//   effectiveVisibility = floor(baseVisibility * precipMultiplierBp * fogMultiplierBp *
//     daylightMultiplierBp * glareMultiplierBp * smokeMultiplierBp / 10_000^5)
// The exact rational product is computed as BigInt (the intermediate product
// exceeds Number.MAX_SAFE_INTEGER — ENGINEERING-CONTRACT authorises `bigint`
// after bound analysis). Rounded once with FLOOR.
// A missing (undefined/null) factor fails with WEATHER_VISIBILITY_FORMULA_MISSING.
import { BluewaveError } from "@bluewave/contracts";
import { VISIBILITY_SCALE_EXPONENT, VISIBILITY_ROUNDING } from "./constants.js";
import { WEATHER_VISIBILITY_FORMULA_MISSING } from "./reasonCodes.js";

export interface VisibilityFormulaInput {
  baseVisibilityUm: number;
  precipitationMultiplierBp: number;
  fogMultiplierBp: number;
  daylightMultiplierBp: number;
  glareMultiplierBp: number;
  smokeMultiplierBp: number;
}

export interface VisibilityFormulaResult {
  effectiveVisibilityUm: number;
  formulaVersion: string;
  rounding: string;
  /** The BigInt intermediate for traceability. Stored as string (deterministic). */
  productString: string;
  divisorString: string;
}

// DESIGN-42 §5: 10_000^5 = 10^20
const SCALE_DIVISOR = BigInt(10_000) ** BigInt(VISIBILITY_SCALE_EXPONENT); // 10_000^5

function factorError(factorKey: string, value: unknown): never {
  throw new BluewaveError(WEATHER_VISIBILITY_FORMULA_MISSING, {
    code: WEATHER_VISIBILITY_FORMULA_MISSING,
    factorKey,
    value,
  });
}

// AC-6: compute the effective visibility distance. Every multiplier MUST be
// explicit (>= 0 integer basis-point value). A missing (undefined/null) factor
// fails with WEATHER_VISIBILITY_FORMULA_MISSING.
export function computeEffectiveVisibility(input: VisibilityFormulaInput): VisibilityFormulaResult {
  const {
    baseVisibilityUm,
    precipitationMultiplierBp,
    fogMultiplierBp,
    daylightMultiplierBp,
    glareMultiplierBp,
    smokeMultiplierBp,
  } = input;

  if (
    typeof baseVisibilityUm !== "number" ||
    !Number.isInteger(baseVisibilityUm) ||
    baseVisibilityUm < 0
  ) {
    factorError("baseVisibilityUm", baseVisibilityUm);
  }

  // Every multiplier must be a non-negative integer. Undefined/null/NaN fail.
  const factors = [
    ["precipitationMultiplierBp", precipitationMultiplierBp],
    ["fogMultiplierBp", fogMultiplierBp],
    ["daylightMultiplierBp", daylightMultiplierBp],
    ["glareMultiplierBp", glareMultiplierBp],
    ["smokeMultiplierBp", smokeMultiplierBp],
  ] as const;

  for (const [key, value] of factors) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      factorError(key, value);
    }
  }

  // BigInt product: all values are non-negative integers.
  const product =
    BigInt(baseVisibilityUm) *
    BigInt(precipitationMultiplierBp) *
    BigInt(fogMultiplierBp) *
    BigInt(daylightMultiplierBp) *
    BigInt(glareMultiplierBp) *
    BigInt(smokeMultiplierBp);

  const divisor = SCALE_DIVISOR;
  // BigInt division truncates toward zero (= floor for positive numbers).
  const effectiveVisibilityUm = Number(product / divisor);

  return {
    effectiveVisibilityUm,
    formulaVersion: "weather_visibility_v1",
    rounding: VISIBILITY_ROUNDING,
    productString: product.toString(),
    divisorString: divisor.toString(),
  };
}

// Validated contract for the visibility formula.
export function computeVisibilityWithValidation(
  input: VisibilityFormulaInput,
): VisibilityFormulaResult {
  const result = computeEffectiveVisibility(input);
  if (result.effectiveVisibilityUm < 0) {
    throw new BluewaveError(WEATHER_VISIBILITY_FORMULA_MISSING, {
      code: WEATHER_VISIBILITY_FORMULA_MISSING,
      reason: "effectiveVisibilityUm must be non-negative",
    });
  }
  return result;
}
