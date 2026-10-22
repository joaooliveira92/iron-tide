import { BluewaveError } from "@bluewave/contracts";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
} from "./constants.js";
import { MINE_LAYING_DENOMINATOR } from "./laying.js";
import { MINESWEEPING_SHIP_INELIGIBLE } from "./reasonCodes.js";

export const mineSweepingPolicyId = "mine_sweeping_v1" as const;

export const MINE_SWEEPING_DENOMINATOR: bigint = MINE_LAYING_DENOMINATOR;

export const MINE_SWEEPING_FACTOR_KEYS = [
  "equipmentModeMultiplierBp",
  "technologyMultiplierBp",
  "crewMultiplierBp",
  "readinessMultiplierBp",
  "damageMultiplierBp",
  "supportMultiplierBp",
] as const;
export type MineSweepingFactorKey = (typeof MINE_SWEEPING_FACTOR_KEYS)[number];

export const MINE_SWEEPING_FORMULA =
  "effectiveSweepingValue = floor(baseSweepingValue * product(6 multiplierBp) / 10_000^6)" as const;
export const MINE_SWEEPING_ROUNDING = "floor" as const;

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

export const SHIPPED_MINE_SWEEPING_BASE_VALUES: Readonly<Record<SweepingBaseValueKey, number>> = {
  DEDICATED_FLEET_MINESWEEPER: 150,
  DEDICATED_COASTAL_MINESWEEPER: 100,
  DD_WITH_MINE_SWEEPING_EQUIPMENT: 80,
  KE_WITH_MINE_SWEEPING_EQUIPMENT: 100,
  CL_WITH_MINE_SWEEPING_EQUIPMENT: 60,
  AMC_WITH_MINE_SWEEPING_EQUIPMENT: 50,
  CONVERTED_TR_MINESWEEPER: 120,
};

export interface MineSweepingContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  keys: readonly SweepingBaseValueKey[];
  baseValues: Record<SweepingBaseValueKey, number>;
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

export function baseSweepingValueFor(key: SweepingBaseValueKey): number {
  return SHIPPED_MINE_SWEEPING_BASE_VALUES[key];
}

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
