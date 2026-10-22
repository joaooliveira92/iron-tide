import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
} from "./constants.js";
import { INVALID_MINE_PRESSURE_STATE, MINE_DEFENSIVE_STANDOFF_ACTIVE } from "./reasonCodes.js";

export const mineDefensiveStandoffPolicyId = "mine_defensive_standoff_v1" as const;

export const MINE_STANDOFF_NONE_LEVEL = "none" as const;
export type DefensiveStandoffLevelValue = 1 | 2 | 3 | 4;
export type DefensiveStandoffLevel = typeof MINE_STANDOFF_NONE_LEVEL | DefensiveStandoffLevelValue;

export const MINE_STANDOFF_MAX_PRESSURE = 1_000_000 as const;
export const MINE_STANDOFF_MIN_ACTIVE_PRESSURE = 100_000 as const;

export const MINE_DEFENSIVE_STANDOFF_LEVELS_AND_EFFECTS: ReadonlyArray<{
  level: DefensiveStandoffLevelValue;
  lowerBoundInclusive: number;
  upperBoundInclusive: number;
  utilityMultiplierBp: number;
}> = [
  {
    level: 1,
    lowerBoundInclusive: 100_000,
    upperBoundInclusive: 249_999,
    utilityMultiplierBp: 9_000,
  },
  {
    level: 2,
    lowerBoundInclusive: 250_000,
    upperBoundInclusive: 499_999,
    utilityMultiplierBp: 7_500,
  },
  {
    level: 3,
    lowerBoundInclusive: 500_000,
    upperBoundInclusive: 749_999,
    utilityMultiplierBp: 5_000,
  },
  {
    level: 4,
    lowerBoundInclusive: 750_000,
    upperBoundInclusive: 1_000_000,
    utilityMultiplierBp: 2_500,
  },
];

export interface MineDefensiveStandoffContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  noneUpperBoundExclusive: number;
  levels: readonly {
    level: DefensiveStandoffLevelValue;
    lowerBoundInclusive: number;
    upperBoundInclusive: number;
    utilityMultiplierBp: number;
  }[];
  maxPressure: number;
  mustNotAutoCancelAcceptedOperation: boolean;
}

export const SHIPPED_MINE_DEFENSIVE_STANDOFF_CONTRACT: MineDefensiveStandoffContract = {
  policyId: mineDefensiveStandoffPolicyId,
  rulesetVersion: MINE_RULESET_VERSION,
  formulaVersion: MINE_FORMULA_VERSION,
  basisPointsPerUnit: MINE_BASIS_POINTS_PER_UNIT,
  noneUpperBoundExclusive: MINE_STANDOFF_MIN_ACTIVE_PRESSURE,
  levels: MINE_DEFENSIVE_STANDOFF_LEVELS_AND_EFFECTS,
  maxPressure: MINE_STANDOFF_MAX_PRESSURE,
  mustNotAutoCancelAcceptedOperation: true,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
    code: INVALID_MINE_PRESSURE_STATE,
    contract,
    reason,
  });
}

function levelRowEquals(
  a: {
    level: DefensiveStandoffLevelValue;
    lowerBoundInclusive: number;
    upperBoundInclusive: number;
    utilityMultiplierBp: number;
  },
  b: {
    level: DefensiveStandoffLevelValue;
    lowerBoundInclusive: number;
    upperBoundInclusive: number;
    utilityMultiplierBp: number;
  },
): boolean {
  return (
    a.level === b.level &&
    a.lowerBoundInclusive === b.lowerBoundInclusive &&
    a.upperBoundInclusive === b.upperBoundInclusive &&
    a.utilityMultiplierBp === b.utilityMultiplierBp
  );
}

export function validateMineDefensiveStandoffContract(
  c: Partial<MineDefensiveStandoffContract> | null | undefined,
): asserts c is MineDefensiveStandoffContract {
  if (!c) throwMismatch(c, "mine_defensive_standoff_v1 missing contract");
  if (c.policyId !== mineDefensiveStandoffPolicyId)
    throwMismatch(c, "mine_defensive_standoff_v1 expected policy id");
  if (c.rulesetVersion !== MINE_RULESET_VERSION || c.formulaVersion !== MINE_FORMULA_VERSION)
    throwMismatch(c, "mine_defensive_standoff_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== MINE_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "mine_defensive_standoff_v1 basis-point scale");
  if (c.noneUpperBoundExclusive !== MINE_STANDOFF_MIN_ACTIVE_PRESSURE)
    throwMismatch(c, "mine_defensive_standoff_v1 §16 'below 100_000 -> none' boundary");
  if (!c.levels || !(c.levels.length === MINE_DEFENSIVE_STANDOFF_LEVELS_AND_EFFECTS.length))
    throwMismatch(c, "mine_defensive_standoff_v1 §16 four-level closed set length");
  for (let i = 0; i < MINE_DEFENSIVE_STANDOFF_LEVELS_AND_EFFECTS.length; i++) {
    if (!levelRowEquals(c.levels[i]!, MINE_DEFENSIVE_STANDOFF_LEVELS_AND_EFFECTS[i]!))
      throwMismatch(c, `mine_defensive_standoff_v1 §16 exact level row ${i}`);
  }
  if (c.maxPressure !== MINE_STANDOFF_MAX_PRESSURE)
    throwMismatch(c, "mine_defensive_standoff_v1 §16/§1 pressure ceiling must be 1_000_000");
  if (c.mustNotAutoCancelAcceptedOperation !== true)
    throwMismatch(c, "mine_defensive_standoff_v1 §16 auto-cancel prohibition fact");
}

export interface DefensiveStandoffActiveResult {
  level: Exclude<DefensiveStandoffLevel, typeof MINE_STANDOFF_NONE_LEVEL>;
  utilityMultiplierBp: number;
  standoffActiveCode: typeof MINE_DEFENSIVE_STANDOFF_ACTIVE;
}

export interface DefensiveStandoffNoneResult {
  level: typeof MINE_STANDOFF_NONE_LEVEL;
  utilityMultiplierBp: null;
  standoffActiveCode: null;
}

export type DefensiveStandoffResult = DefensiveStandoffActiveResult | DefensiveStandoffNoneResult;

function standoffPressureMismatch(currentPressure: SafeInt, reason: string): never {
  throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
    code: INVALID_MINE_PRESSURE_STATE,
    field: "currentPressure",
    reason,
    value: currentPressure,
  });
}

export function computeDefensiveStandoff(currentPressure: SafeInt): DefensiveStandoffResult {
  if (
    !SafeInt.isSafeInt(currentPressure) ||
    currentPressure < 0 ||
    currentPressure > MINE_STANDOFF_MAX_PRESSURE
  )
    standoffPressureMismatch(
      currentPressure,
      `current pressure must be a safe integer within 0..${MINE_STANDOFF_MAX_PRESSURE} (§1)`,
    );
  if (currentPressure < MINE_STANDOFF_MIN_ACTIVE_PRESSURE)
    return { level: MINE_STANDOFF_NONE_LEVEL, utilityMultiplierBp: null, standoffActiveCode: null };
  for (const row of MINE_DEFENSIVE_STANDOFF_LEVELS_AND_EFFECTS) {
    if (currentPressure >= row.lowerBoundInclusive && currentPressure <= row.upperBoundInclusive)
      return {
        level: row.level,
        utilityMultiplierBp: row.utilityMultiplierBp,
        standoffActiveCode: MINE_DEFENSIVE_STANDOFF_ACTIVE,
      };
  }
  standoffPressureMismatch(
    currentPressure,
    "validated pressure must fall in exactly one closed §16 level range — table drift?",
  );
}
