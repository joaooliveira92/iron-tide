// DESIGN-35 §16 defensive standoff (INC-5, value-only). Mine pressure creates
// defensive standoff ONLY through `mine_defensive_standoff_v1` (SHIPPED contract +
// validate guard, fail-closed like INC-1/INC-3). The shipped §16 levels:
//   <100_000            none
//   100_000..249_999    level 1
//   250_000..499_999    level 2
//   500_000..749_999    level 3
//   750_000..1_000_000  level 4
// with hostile amphibious/coastal-operation utility multipliers (basis points):
//   level 1 9_000, level 2 7_500, level 3 5_000, level 4 2_500.
//
// §16: "Standoff modifies AI and operation eligibility or cost only through
// explicit amphibious, blockade, and coastal-operation contracts. It MUST NOT
// automatically cancel an accepted operation." THIS IS A DOCUMENTATION
// OBLIGATION, NOT BEHAVIOR: there is no operation-cancellation mechanic in  this
// slice to cancel, and NO consumer is wired (the amphibious/blockade/coastal
// contracts do not exist yet — DESIGN-36 is unassigned). computeDefensiveStandoff
// therefore only derives {level, utilityMultiplierBp} from a validated pressure
// and flags MINE_DEFENSIVE_STANDOFF_ACTIVE; it never touches any operation.
//
// §1 pressure semantics: 0 = no minefield = `none`; 1_000_000 = level 4.
//
// Pure/deterministic: no I/O/clock/random; fixed integer constants only.
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
/** The closed §16 level vocabulary: `"none"` (no minefield / below 100_000) or levels 1..4. */
export type DefensiveStandoffLevel = typeof MINE_STANDOFF_NONE_LEVEL | DefensiveStandoffLevelValue;

// §16 pressure ceiling: the maximum authoritative mine pressure (§1 `1..1_000_000`).
export const MINE_STANDOFF_MAX_PRESSURE = 1_000_000 as const;
// §16 first-level entry pressure (below this -> none).
export const MINE_STANDOFF_MIN_ACTIVE_PRESSURE = 100_000 as const;

// Exact §16 shipped standoff levels + effects. Ranges are closed [lower, upper];
// they tile [100_000, 1_000_000] exactly, so a validated pressure in that range
// always matches exactly one row.
export const MINE_DEFENSIVE_STANDOFF_LEVELS_AND_EFFECTS: ReadonlyArray<{
  level: DefensiveStandoffLevelValue;
  lowerBoundInclusive: number;
  upperBoundInclusive: number;
  /** Hostile amphibious/coastal-operation utility multiplier (basis points). */
  utilityMultiplierBp: number;
}> = [
  {
    level: 1,
    lowerBoundInclusive: 100_000,
    upperBoundInclusive: 249_999,
    utilityMultiplierBp: 9_000,
  }, // §16 literal
  {
    level: 2,
    lowerBoundInclusive: 250_000,
    upperBoundInclusive: 499_999,
    utilityMultiplierBp: 7_500,
  }, // §16 literal
  {
    level: 3,
    lowerBoundInclusive: 500_000,
    upperBoundInclusive: 749_999,
    utilityMultiplierBp: 5_000,
  }, // §16 literal
  {
    level: 4,
    lowerBoundInclusive: 750_000,
    upperBoundInclusive: 1_000_000,
    utilityMultiplierBp: 2_500,
  }, // §16 literal
];

// The §16 closed level list is the ordered rows above (length 4, levels 1..4).

export interface MineDefensiveStandoffContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  /** Pressure below this value maps to `none` (§1: 0 = no minefield -> none). */
  noneUpperBoundExclusive: number;
  /** §16 exact shipped level rows (closed pressure ranges + exact utility multipliers). */
  levels: readonly {
    level: DefensiveStandoffLevelValue;
    lowerBoundInclusive: number;
    upperBoundInclusive: number;
    utilityMultiplierBp: number;
  }[];
  /** §1/§16 pressure ceiling (1_000_000). */
  maxPressure: number;
  /** §16 MUST NOT auto-cancel an accepted operation — documented obligation, shipped as a contract fact. */
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

// AC-11/AC-24: fail-closed guard over the §16 level + effect table. A tampered /
// partial / extra level row, wrong pressure boundary, wrong effect, or cleared
// auto-cancel obligation never passes — any drift after shipping fails here
// instead of inside the derivation.
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

// ---- §16 derivation ----

export interface DefensiveStandoffActiveResult {
  level: Exclude<DefensiveStandoffLevel, typeof MINE_STANDOFF_NONE_LEVEL>;
  /** Hostile amphibious / coastal-operation utility multiplier (basis points). */
  utilityMultiplierBp: number;
  /** §30 event code emitted because level > none. */
  standoffActiveCode: typeof MINE_DEFENSIVE_STANDOFF_ACTIVE;
}

export interface DefensiveStandoffNoneResult {
  level: typeof MINE_STANDOFF_NONE_LEVEL;
  utilityMultiplierBp: null;
  /* No standoff -> no MINE_DEFENSIVE_STANDOFF_ACTIVE emit. */
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

// AC-11: pure §16 derivation of {level, utilityMultiplierBp} from a VALIDATED
// current mine pressure (SafeInt within 0..1_000_000). 0 = no minefield -> none
// (§1 zero-pressure semantics); 1_000_000 -> level 4.
//
// `standoffActiveCode` flags MINE_DEFENSIVE_STANDOFF_ACTIVE when level > none —
// a DERIVED EVENT FLAG, never a cancel/deny action. §16 forbids automatic
// cancellation of an accepted operation; there is no cancellation mechanic to
// cancel, and NO consumer (amphibious/blockade contract) exists yet, so this
// flag is data only. The caller (a future amphibious/blockade contract) decides
// how the utility multiplier modifies eligibility/cost — NOT here.
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
  // Unreachable for any validated pressure in [100_000, 1_000_000] (the closed
  // rows tile that interval exactly) — fail closed rather than return undefined.
  standoffPressureMismatch(
    currentPressure,
    "validated pressure must fall in exactly one closed §16 level range — table drift?",
  );
}
