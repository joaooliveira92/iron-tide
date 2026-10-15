// DESIGN-35 §7 sweeping base values (INC-3): the shipped base sweeping values
//   dedicated fleet minesweeper   150
//   dedicated coastal minesweeper 100
//   DD with mine-sweeping equipment  80
//   KE with mine-sweeping equipment 100
//   CL with mine-sweeping equipment  60
//   AMC with mine-sweeping equipment 50
//   converted TR minesweeper         120
//
// Every equipment definition identifies EXACTLY ONE base value (or an explicit
// replacement formula — none is authored this increment, so the lookup is the
// exhaustive shipped key-to-value map). §7 "A ship name or class description
// MUST NOT grant sweeping value": the lookup keys off the ship's combat-type /
// equipment key ONLY — free-text names/classes are structurally rejected (they
// are not members of the closed key union) and fail closed at runtime.
//
// The generalising §6 "or another explicitly eligible type" category is NOT a
// shipped §7 equipment definition (no content pack exists this sprint): an
// OTHER_EXPLICITLY_ELIGIBLE ship has a valid §6 type predicate but the §7 base
// lookup fails closed (MINESWEEPING_SHIP_INELIGIBLE) until a content
// definition authorises a base value — never a silent default.
//
// This module also OWNS the single sweep-policy contract `mine_sweeping_v1`
// (spec AC-24 naming): bundled §7 base-value table + §9 effective-value
// formula facts (the shared 10_000^6 denominator, the ordered six-factor
// keys, the one-FLOOR rounding). effective-sweeping.ts imports these constants
// here (dependency stays one-way: effective -> base values) and ships the §9
// formula functions. Pure/deterministic: no I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
} from "./constants.js";
import { MINE_LAYING_DENOMINATOR } from "./laying.js";
import { MINESWEEPING_SHIP_INELIGIBLE } from "./reasonCodes.js";

export const mineSweepingPolicyId = "mine_sweeping_v1" as const;

// Exact shared denominator 10_000^6 (bigint; 10^24 — inside bigint range, far
// outside Number's safe-integer range; the §9 numerator bound analysis lives
// in effective-sweeping.ts). One denominator for §4 laying and §9 sweeping:
// DESIGN-35 uses the same 10_000^6 scale in both formulas; the alias keeps
// them provably equal.
export const MINE_SWEEPING_DENOMINATOR: bigint = MINE_LAYING_DENOMINATOR;

// Ordered §9 factor keys (the six multipliers in the §9 product).
export const MINE_SWEEPING_FACTOR_KEYS = [
  "equipmentModeMultiplierBp",
  "technologyMultiplierBp",
  "crewMultiplierBp",
  "readinessMultiplierBp",
  "damageMultiplierBp",
  "supportMultiplierBp",
] as const;
export type MineSweepingFactorKey = (typeof MINE_SWEEPING_FACTOR_KEYS)[number];

// The §9 effective-value formula shape, pinned in the shipped contract (ASCII
// by design: canonical-serializer friendly).
export const MINE_SWEEPING_FORMULA =
  "effectiveSweepingValue = floor(baseSweepingValue * product(6 multiplierBp) / 10_000^6)" as const;
export const MINE_SWEEPING_ROUNDING = "floor" as const;

// §7 closed equipment/type-key vocabulary that CAN carry a shipped base value.
export const SWEEPING_BASE_VALUE_KEYS = [
  "DEDICATED_FLEET_MINESWEEPER",
  "DEDICATED_COASTAL_MINESWEEPER",
  "DD_WITH_MINE_SWEEPING_EQUIPMENT",
  "KE_WITH_MINE_SWEEPING_EQUIPMENT",
  "CL_WITH_MINE_SWEEPING_EQUIPMENT",
  "AMC_WITH_MINE_SWEEPING_EQUIPMENT",
  "CONVERTED_TR_MINESWEEPER",
] as const;
export type SweepingBaseValueKey = (typeof SWEEPING_BASE_VALUE_KEYS)[number];

// §7 literal base sweeping values. Each key maps to exactly one integer.
export const SHIPPED_MINE_SWEEPING_BASE_VALUES: Readonly<Record<SweepingBaseValueKey, number>> = {
  DEDICATED_FLEET_MINESWEEPER: 150, // §7 literal
  DEDICATED_COASTAL_MINESWEEPER: 100, // §7 literal
  DD_WITH_MINE_SWEEPING_EQUIPMENT: 80, // §7 literal
  KE_WITH_MINE_SWEEPING_EQUIPMENT: 100, // §7 literal
  CL_WITH_MINE_SWEEPING_EQUIPMENT: 60, // §7 literal
  AMC_WITH_MINE_SWEEPING_EQUIPMENT: 50, // §7 literal
  CONVERTED_TR_MINESWEEPER: 120, // §7 literal
};

// AC-24: the bundled mine_sweeping_v1 contract — §7 base-value table + §9
// effective-value formula facts (denominator, ordered factor keys, one-FLOOR
// rounding). One policy, one SHIPPED contract (mirroring INC-1's
// SHIPPED_MINE_TYPE_DEFINITIONS_CONTRACT guard).
export interface MineSweepingContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  keys: readonly SweepingBaseValueKey[];
  // Serialized body: shipped base sweeping values by key.
  baseValues: Record<SweepingBaseValueKey, number>;
  // §9 formula facts.
  denominator: string;
  factorKeys: readonly MineSweepingFactorKey[];
  formula: string;
  rounding: string;
}

export const SHIPPED_MINE_SWEEPING_CONTRACT: MineSweepingContract = {
  policyId: mineSweepingPolicyId,
  rulesetVersion: MINE_RULESET_VERSION,
  formulaVersion: MINE_FORMULA_VERSION,
  basisPointsPerUnit: MINE_BASIS_POINTS_PER_UNIT,
  keys: SWEEPING_BASE_VALUE_KEYS,
  baseValues: SHIPPED_MINE_SWEEPING_BASE_VALUES,
  denominator: MINE_SWEEPING_DENOMINATOR.toString(),
  factorKeys: MINE_SWEEPING_FACTOR_KEYS,
  formula: MINE_SWEEPING_FORMULA,
  rounding: MINE_SWEEPING_ROUNDING,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(MINESWEEPING_SHIP_INELIGIBLE, {
    code: MINESWEEPING_SHIP_INELIGIBLE,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// AC-7/AC-24: fail-closed guard over the §7 base-value table + §9 formula
// facts. A missing/tampered key, value, denominator, factor key, formula, or
// rounding mode never passes. Runs at load; any drift after shipping fails
// here instead of inside the formula.
export function validateMineSweepingContract(
  c: Partial<MineSweepingContract> | null | undefined,
): asserts c is MineSweepingContract {
  if (!c) throwMismatch(c, "mine_sweeping_v1 missing contract");
  if (c.policyId !== mineSweepingPolicyId) throwMismatch(c, "mine_sweeping_v1 expected policy id");
  if (c.rulesetVersion !== MINE_RULESET_VERSION || c.formulaVersion !== MINE_FORMULA_VERSION)
    throwMismatch(c, "mine_sweeping_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== MINE_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "mine_sweeping_v1 basis-point scale");
  if (!c.keys || !arrayEquals(c.keys, SWEEPING_BASE_VALUE_KEYS))
    throwMismatch(c, "mine_sweeping_v1 closed §7 key set");
  if (!c.baseValues || typeof c.baseValues !== "object")
    throwMismatch(c, "mine_sweeping_v1 base-value table missing");
  for (const key of SWEEPING_BASE_VALUE_KEYS) {
    const shipped = SHIPPED_MINE_SWEEPING_BASE_VALUES[key];
    if (c.baseValues[key] !== shipped)
      throwMismatch(c, `mine_sweeping_v1 §7 base sweeping value for ${key}`);
  }
  if (c.denominator !== MINE_SWEEPING_DENOMINATOR.toString())
    throwMismatch(c, "mine_sweeping_v1 §9 denominator must be 10_000^6");
  if (!c.factorKeys || !(c.factorKeys.length === MINE_SWEEPING_FACTOR_KEYS.length))
    throwMismatch(c, "mine_sweeping_v1 §9 factor-keys length");
  for (let i = 0; i < MINE_SWEEPING_FACTOR_KEYS.length; i++) {
    if (c.factorKeys[i] !== MINE_SWEEPING_FACTOR_KEYS[i])
      throwMismatch(c, "mine_sweeping_v1 §9 ordered factor keys");
  }
  if (c.formula !== MINE_SWEEPING_FORMULA) throwMismatch(c, "mine_sweeping_v1 §9 formula");
  if (c.rounding !== MINE_SWEEPING_ROUNDING)
    throwMismatch(c, "mine_sweeping_v1 §9 rounding (floor)");
}

// AC-7: the exact shipped §7 base value for a closed §7 key (typed path, total
// by construction — the fail-closed unverified path is baseSweepingValueById).
export function baseSweepingValueFor(key: SweepingBaseValueKey): number {
  return SHIPPED_MINE_SWEEPING_BASE_VALUES[key];
}

// AC-7: fail-closed lookup by an unverified / external key string (e.g. a
// deserialized ship's equipment key, or the "other explicitly eligible"
// category with no shipped §7 definition). A name/class free-text or any key
// without a shipped base value fails with MINESWEEPING_SHIP_INELIGIBLE — never
// a silent default (a ship name/class MUST NOT grant sweeping value).
export function baseSweepingValueById(key: string): number {
  if (!(SWEEPING_BASE_VALUE_KEYS as readonly string[]).includes(key)) {
    throw new BluewaveError(MINESWEEPING_SHIP_INELIGIBLE, {
      code: MINESWEEPING_SHIP_INELIGIBLE,
      reason:
        "unknown sweeping equipment/type key — no shipped §7 base value exists (lookup is by combat-type/equipment key only, never a ship name or class description)",
      value: key,
    });
  }
  return baseSweepingValueFor(key as SweepingBaseValueKey);
}
