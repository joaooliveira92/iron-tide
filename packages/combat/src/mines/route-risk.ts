// DESIGN-35 §13 strategic route risk (INC-5, value-only). For every route edge
// covered by mine pressure:
//   routeRiskBp = min(10_000, floor(currentPressure * freshnessBp *
//     routeExposureMultiplierBp * targetSusceptibilityMultiplierBp
//     / 1_000_000 / 10_000 / 10_000))
//
// The shipped route-exposure multipliers (§13):
//   open sea edge 5_000, coastal passage 10_000, canal approach 15_000,
//   choke point 15_000, port approach 12_500.
// targetSusceptibilityMultiplierBp is a TARGET/VICTIM property NOT shipped by
// DESIGN-35 — it is a caller-supplied basis-point value in 0..10_000.
//
// NO MOVEMENT-BLOCKING / CONSUMING BEHAVIOR IS WIRED (§13: "A route-risk check
// does not automatically deny movement unless a command or AI policy chooses
// another route"; consumption is blocked on DESIGN-25 — recorded in ticket 03).
// computeRouteRiskBp is a pure value derivation; MINE_ROUTE_RISK_CREATED is a
// DERIVED EVENT FLAG when routeRiskBp > 0, never an auto-deny.
//
// EXACTNESS + THE BIGINT BOUND: currentPressure up to 1_000_000 × freshness up
// to 10_000 × exposure up to 15_000 × susceptibility up to 10_000 ≈ 1.5e18,
// which EXCEEDS Number.MAX_SAFE_INTEGER (≈ 9.007e15). The numerator is therefore
// computed as a BIGINT PRODUCT, then divided by the exact 10^14 denominator with
// ONE BIGINT DIVISION (= ONE FLOOR, since every factor is non-negative). All
// inputs are validated integers in closed ranges, so no rounding/precision loss.
//
// Pure/deterministic: no I/O/clock/random; fixed integer semantics only.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
} from "./constants.js";
import { INVALID_MINE_PRESSURE_STATE, MINE_ROUTE_RISK_CREATED } from "./reasonCodes.js";

export const routeRiskPolicyId = "mine_route_risk_v1" as const;

// Exact §13 clamp ceiling.
export const MINE_ROUTE_RISK_MAX_BP = 10_000 as const;
// §13 exact denominator: 1_000_000 × 10_000 × 10_000 = 10^14.
export const MINE_ROUTE_RISK_DENOMINATOR: bigint =
  BigInt(1_000_000) * BigInt(10_000) * BigInt(10_000);
// §13 formula shape pinned in the shipped contract (ASCII, canonical-serializer friendly).
export const MINE_ROUTE_RISK_FORMULA =
  "routeRiskBp = min(10_000, floor(currentPressure * freshnessBp * routeExposureMultiplierBp * targetSusceptibilityMultiplierBp / 1_000_000 / 10_000 / 10_000))" as const;
export const MINE_ROUTE_RISK_ROUNDING = "floor" as const;

// §13 closed route-edge vocabulary carrying a shipped exposure multiplier.
export const ROUTE_EXPOSURE_KEYS = [
  "OPEN_SEA_EDGE",
  "COASTAL_PASSAGE",
  "CANAL_APPROACH",
  "CHOKE_POINT",
  "PORT_APPROACH",
] as const;
export type RouteExposureKey = (typeof ROUTE_EXPOSURE_KEYS)[number];

// §13 literal shipped route-exposure multipliers. Each edge maps to exactly one
// integer — never invented or inferred.
export const ROUTE_EXPOSURE_MULTIPLIERS_BP: Readonly<Record<RouteExposureKey, number>> = {
  OPEN_SEA_EDGE: 5_000, // §13 literal
  COASTAL_PASSAGE: 10_000, // §13 literal
  CANAL_APPROACH: 15_000, // §13 literal
  CHOKE_POINT: 15_000, // §13 literal
  PORT_APPROACH: 12_500, // §13 literal
};

// §1/§13 input closed ranges.
export const MINE_ROUTE_RISK_MAX_PRESSURE = 1_000_000 as const; // §1 pressure ceiling
export const MINE_ROUTE_RISK_MAX_FRESHNESS_BP = 10_000 as const; // §1 freshness ceiling
export const MINE_ROUTE_RISK_MAX_EXPOSURE_BP = 15_000 as const; // shipped max exposure (canal/choke)
export const MINE_ROUTE_RISK_MAX_SUSCEPTIBILITY_BP = 10_000 as const; // §13 caller-supplied target property

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

// AC-12/AC-24: fail-closed guard over the §13 formula facts + shipped exposure
// multipliers + input bounds. A tampered multiplier, broken formula/denominator,
// or drifted boundary never passes — any drift after shipping fails here instead
// of inside the derivation.
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

// ---- §13 lookups ----

// AC-12: fail-closed lookup of the shipped §13 edge multiplier by an unverified /
// external key string. An unknown edge fails with INVALID_MINE_PRESSURE_STATE —
// NEVER a silent default (a route edge outside the shipped set grants no
// exposure multiplier). No dedicated route-exposure reason code exists in §30, so
// the module's invariant code is reused (mirrors INC-4's reuse for invalid
// allocation inputs); documented, not a silent fallback.
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

/** Total-by-construction typed lookup (closed key union). */
export function routeExposureMultiplierBpFor(key: RouteExposureKey): number {
  return ROUTE_EXPOSURE_MULTIPLIERS_BP[key];
}

// ---- §13 derivation ----

function routeRiskInputMismatch(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
    code: INVALID_MINE_PRESSURE_STATE,
    field,
    reason,
    value,
  });
}

export interface RouteRiskResult {
  /** The §13 route-risk value (SafeInt 0..10_000). */
  routeRiskBp: SafeInt;
  /** MINE_ROUTE_RISK_CREATED when routeRiskBp > 0; null when it is 0. */
  riskFlag: typeof MINE_ROUTE_RISK_CREATED | null;
}

// AC-12: pure §13 derivation. All inputs are validated; the product is computed
// as a BIGINT so the intermediate (up to ≈1.5e18) never loses integer precision
// beyond Number.MAX_SAFE_INTEGER, and divided ONCE by the exact 10^14
// denominator (ONE FLOOR), then clamped to 10_000 with min.
//
// pressure is SafeInt 0..1_000_000 (0 = no pressure -> routeRisk 0, which §13
// treats as "not covered by mine pressure"; a positive covered record is how a
// caller reaches this function — the pure value function is total over 0..10^6).
// riskFlag is MINE_ROUTE_RISK_CREATED iff routeRiskBp > 0 — a DERIVED EVENT, never
// an automatic movement denial (§13 / ticket 03: blocked on DESIGN-25).
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

  // Bigint numerator (never a Number product — the intermediate exceeds
  // MAX_SAFE_INTEGER); one bigint division = one FLOOR (all factors >= 0).
  const numerator =
    BigInt(Number(currentPressure)) *
    BigInt(Number(freshnessBp)) *
    BigInt(routeExposureMultiplierBpValue) *
    BigInt(targetSusceptibilityMultiplierBp);
  const quotient = numerator / MINE_ROUTE_RISK_DENOMINATOR;
  const floorResult = Number(quotient); // integer >= 0
  const routeRiskBp = SafeInt(Math.min(MINE_ROUTE_RISK_MAX_BP, floorResult));
  return { routeRiskBp, riskFlag: routeRiskBp > 0 ? MINE_ROUTE_RISK_CREATED : null };
}

// ---- §10 allocation seam adapter (INC-4 ─ INC-5) ----

// INC-4's sweepingAllocationOrder key-2 accessor `recordRiskPriority` (see
// sweeping-aggregation.ts) is "higher number = higher current strike risk =
// earlier". This increment finally provides the REAL §13 route-risk value that
// INC-4's accessor seam was waiting for: a larger routeRiskBp is higher risk and
// must sweep FIRST. This pure adapter maps a §13 routeRiskBp to that priority
// unchanged (0..10_000 order-preserving). INC-4's comparator and its
// DEFAULT_STRIKE_RISK_PRIORITY are NOT altered here — INC-4 still runs on the
// default until INC-8's assembler wires the real per-record §13 value into the
// `recordRiskPriority` accessor (a call-site decision that belongs to INC-8's
// records/ordering work), where routeRiskBpToAllocationPriority(computeRouteRiskBp(...).routeRiskBp)
// becomes the risk key. Documented seam — no INC-4 code change required.
export function routeRiskBpToAllocationPriority(routeRiskBp: number): number {
  if (!SafeInt.isSafeInt(routeRiskBp) || routeRiskBp < 0 || routeRiskBp > MINE_ROUTE_RISK_MAX_BP)
    routeRiskInputMismatch(
      "routeRiskBp",
      routeRiskBp,
      `route-risk priority input must be a safe integer within 0..${MINE_ROUTE_RISK_MAX_BP} (§13)`,
    );
  // Higher risk bp = higher priority = earlier in §10 key 2 (order-preserving).
  return routeRiskBp as number;
}
