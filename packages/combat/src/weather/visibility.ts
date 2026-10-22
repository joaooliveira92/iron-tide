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
  productString: string;
  divisorString: string;
}

const SCALE_DIVISOR = BigInt(10_000) ** BigInt(VISIBILITY_SCALE_EXPONENT);

function factorError(factorKey: string, value: unknown): never {
  throw new BluewaveError(WEATHER_VISIBILITY_FORMULA_MISSING, {
    code: WEATHER_VISIBILITY_FORMULA_MISSING,
    factorKey,
    value,
  });
}

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

  const product =
    BigInt(baseVisibilityUm) *
    BigInt(precipitationMultiplierBp) *
    BigInt(fogMultiplierBp) *
    BigInt(daylightMultiplierBp) *
    BigInt(glareMultiplierBp) *
    BigInt(smokeMultiplierBp);

  const divisor = SCALE_DIVISOR;
  const effectiveVisibilityUm = Number(product / divisor);

  return {
    effectiveVisibilityUm,
    formulaVersion: "weather_visibility_v1",
    rounding: VISIBILITY_ROUNDING,
    productString: product.toString(),
    divisorString: divisor.toString(),
  };
}

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
