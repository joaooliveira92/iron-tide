import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
} from "./constants.js";
import { INVALID_MINE_PRESSURE_STATE, MINE_ROUTE_RISK_CREATED } from "./reasonCodes.js";

export const routeRiskPolicyId = "mine_route_risk_v1" as const;

export const MINE_ROUTE_RISK_MAX_BP = 10_000 as const;
export const MINE_ROUTE_RISK_DENOMINATOR: bigint =
  BigInt(1_000_000) * BigInt(10_000) * BigInt(10_000);
export const MINE_ROUTE_RISK_FORMULA =
  "routeRiskBp = min(10_000, floor(currentPressure * freshnessBp * routeExposureMultiplierBp * targetSusceptibilityMultiplierBp / 1_000_000 / 10_000 / 10_000))" as const;
export const MINE_ROUTE_RISK_ROUNDING = "floor" as const;

export const ROUTE_EXPOSURE_KEYS = [
  "OPEN_SEA_EDGE",
  "COASTAL_PASSAGE",
  "CANAL_APPROACH",
  "CHOKE_POINT",
  "PORT_APPROACH",
] as const;
export type RouteExposureKey = (typeof ROUTE_EXPOSURE_KEYS)[number];

export const ROUTE_EXPOSURE_MULTIPLIERS_BP: Readonly<Record<RouteExposureKey, number>> = {
  OPEN_SEA_EDGE: 5_000,
  COASTAL_PASSAGE: 10_000,
  CANAL_APPROACH: 15_000,
  CHOKE_POINT: 15_000,
  PORT_APPROACH: 12_500,
};

export const MINE_ROUTE_RISK_MAX_PRESSURE = 1_000_000 as const;
export const MINE_ROUTE_RISK_MAX_FRESHNESS_BP = 10_000 as const;
export const MINE_ROUTE_RISK_MAX_EXPOSURE_BP = 15_000 as const;
export const MINE_ROUTE_RISK_MAX_SUSCEPTIBILITY_BP = 10_000 as const;

export interface MineRouteRiskContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  formula: string;
  rounding: string;
  clampBp: number;
  denominator: string;
  exposureMultipliers: Record<RouteExposureKey, number>;
  maxPressure: number;
  maxFreshnessBp: number;
  maxExposureBp: number;
  maxSusceptibilityBp: number;
}

export const SHIPPED_MINE_ROUTE_RISK_CONTRACT: MineRouteRiskContract = {
  policyId: routeRiskPolicyId,
  rulesetVersion: MINE_RULESET_VERSION,
  formulaVersion: MINE_FORMULA_VERSION,
  basisPointsPerUnit: MINE_BASIS_POINTS_PER_UNIT,
  formula: MINE_ROUTE_RISK_FORMULA,
  rounding: MINE_ROUTE_RISK_ROUNDING,
  clampBp: MINE_ROUTE_RISK_MAX_BP,
  denominator: MINE_ROUTE_RISK_DENOMINATOR.toString(),
  exposureMultipliers: ROUTE_EXPOSURE_MULTIPLIERS_BP,
  maxPressure: MINE_ROUTE_RISK_MAX_PRESSURE,
  maxFreshnessBp: MINE_ROUTE_RISK_MAX_FRESHNESS_BP,
  maxExposureBp: MINE_ROUTE_RISK_MAX_EXPOSURE_BP,
  maxSusceptibilityBp: MINE_ROUTE_RISK_MAX_SUSCEPTIBILITY_BP,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
    code: INVALID_MINE_PRESSURE_STATE,
    contract,
    reason,
  });
}

export function validateMineRouteRiskContract(
  c: Partial<MineRouteRiskContract> | null | undefined,
): asserts c is MineRouteRiskContract {
  if (!c) throwMismatch(c, "mine_route_risk_v1 missing contract");
  if (c.policyId !== routeRiskPolicyId) throwMismatch(c, "mine_route_risk_v1 expected policy id");
  if (c.rulesetVersion !== MINE_RULESET_VERSION || c.formulaVersion !== MINE_FORMULA_VERSION)
    throwMismatch(c, "mine_route_risk_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== MINE_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "mine_route_risk_v1 basis-point scale");
  if (c.formula !== MINE_ROUTE_RISK_FORMULA) throwMismatch(c, "mine_route_risk_v1 §13 formula");
  if (c.rounding !== MINE_ROUTE_RISK_ROUNDING)
    throwMismatch(c, "mine_route_risk_v1 §13 rounding (floor)");
  if (c.clampBp !== MINE_ROUTE_RISK_MAX_BP)
    throwMismatch(c, "mine_route_risk_v1 §13 clamp must be 10_000");
  if (c.denominator !== MINE_ROUTE_RISK_DENOMINATOR.toString())
    throwMismatch(c, "mine_route_risk_v1 §13 denominator must be 1_000_000 × 10_000 × 10_000");
  if (!c.exposureMultipliers || typeof c.exposureMultipliers !== "object")
    throwMismatch(c, "mine_route_risk_v1 §13 exposure table missing");
  for (const key of ROUTE_EXPOSURE_KEYS) {
    if (c.exposureMultipliers[key] !== ROUTE_EXPOSURE_MULTIPLIERS_BP[key])
      throwMismatch(c, `mine_route_risk_v1 §13 route-exposure multiplier for ${key}`);
  }
  if (c.maxPressure !== MINE_ROUTE_RISK_MAX_PRESSURE)
    throwMismatch(c, "mine_route_risk_v1 §1 pressure ceiling");
  if (c.maxFreshnessBp !== MINE_ROUTE_RISK_MAX_FRESHNESS_BP)
    throwMismatch(c, "mine_route_risk_v1 §1 freshness ceiling");
  if (c.maxExposureBp !== MINE_ROUTE_RISK_MAX_EXPOSURE_BP)
    throwMismatch(c, "mine_route_risk_v1 §13 max shipped exposure");
  if (c.maxSusceptibilityBp !== MINE_ROUTE_RISK_MAX_SUSCEPTIBILITY_BP)
    throwMismatch(c, "mine_route_risk_v1 §13 target-susceptibility ceiling");
}

export function routeExposureMultiplierBp(key: string): number {
  if (!(ROUTE_EXPOSURE_KEYS as readonly string[]).includes(key)) {
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "routeExposureKey",
      reason: "unknown route-edge key — not one of the five shipped §13 route-exposure edges",
      value: key,
    });
  }
  return routeExposureMultiplierBpFor(key as RouteExposureKey);
}

export function routeExposureMultiplierBpFor(key: RouteExposureKey): number {
  return ROUTE_EXPOSURE_MULTIPLIERS_BP[key];
}

function routeRiskInputMismatch(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
    code: INVALID_MINE_PRESSURE_STATE,
    field,
    reason,
    value,
  });
}

export interface RouteRiskResult {
  routeRiskBp: SafeInt;
  riskFlag: typeof MINE_ROUTE_RISK_CREATED | null;
}

export function computeRouteRiskBp(
  currentPressure: SafeInt,
  freshnessBp: SafeInt,
  routeExposureMultiplierBpValue: number,
  targetSusceptibilityMultiplierBp: number,
): RouteRiskResult {
  if (
    !SafeInt.isSafeInt(currentPressure) ||
    currentPressure < 0 ||
    currentPressure > MINE_ROUTE_RISK_MAX_PRESSURE
  )
    routeRiskInputMismatch(
      "currentPressure",
      currentPressure,
      `current pressure must be a safe integer within 0..${MINE_ROUTE_RISK_MAX_PRESSURE} (§1)`,
    );
  if (
    !SafeInt.isSafeInt(freshnessBp) ||
    freshnessBp < 0 ||
    freshnessBp > MINE_ROUTE_RISK_MAX_FRESHNESS_BP
  )
    routeRiskInputMismatch(
      "freshnessBp",
      freshnessBp,
      `freshness must be a safe integer within 0..${MINE_ROUTE_RISK_MAX_FRESHNESS_BP} (§1)`,
    );
  if (
    !Number.isInteger(routeExposureMultiplierBpValue) ||
    routeExposureMultiplierBpValue < 0 ||
    routeExposureMultiplierBpValue > MINE_ROUTE_RISK_MAX_EXPOSURE_BP
  )
    routeRiskInputMismatch(
      "routeExposureMultiplierBp",
      routeExposureMultiplierBpValue,
      `route-exposure multiplier must be a basis-point integer within 0..${MINE_ROUTE_RISK_MAX_EXPOSURE_BP} (§13)`,
    );
  if (
    !Number.isInteger(targetSusceptibilityMultiplierBp) ||
    targetSusceptibilityMultiplierBp < 0 ||
    targetSusceptibilityMultiplierBp > MINE_ROUTE_RISK_MAX_SUSCEPTIBILITY_BP
  )
    routeRiskInputMismatch(
      "targetSusceptibilityMultiplierBp",
      targetSusceptibilityMultiplierBp,
      `target-susceptibility multiplier must be a basis-point integer within 0..${MINE_ROUTE_RISK_MAX_SUSCEPTIBILITY_BP} (caller-supplied target property)`,
    );

  const numerator =
    BigInt(Number(currentPressure)) *
    BigInt(Number(freshnessBp)) *
    BigInt(routeExposureMultiplierBpValue) *
    BigInt(targetSusceptibilityMultiplierBp);
  const quotient = numerator / MINE_ROUTE_RISK_DENOMINATOR;
  const floorResult = Number(quotient);
  const routeRiskBp = SafeInt(Math.min(MINE_ROUTE_RISK_MAX_BP, floorResult));
  return { routeRiskBp, riskFlag: routeRiskBp > 0 ? MINE_ROUTE_RISK_CREATED : null };
}

export function routeRiskBpToAllocationPriority(routeRiskBp: number): number {
  if (!SafeInt.isSafeInt(routeRiskBp) || routeRiskBp < 0 || routeRiskBp > MINE_ROUTE_RISK_MAX_BP)
    routeRiskInputMismatch(
      "routeRiskBp",
      routeRiskBp,
      `route-risk priority input must be a safe integer within 0..${MINE_ROUTE_RISK_MAX_BP} (§13)`,
    );
  return routeRiskBp as number;
}
