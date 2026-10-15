// DESIGN-16 section 5 (spec SB3-R16): the versioned `dock_expansion_v1` policy. A completed expansion raises every
// dock mass limit by the era's exact step; the era is resolved from the campaign month in which the project is
// authorized and then frozen on the project. Pure, platform-independent, integer-only.
//
// The shipped values are fixed by DESIGN-16 section 5 (base duration exactly 12 months, permitted range 9..18) and
// section 5.2 (the era-step schedule), so they are authored here as versioned ruleset constants rather than read
// from an opaque balance file. Arithmetic uses checked integers with a BigInt intermediate for the basis-point
// duration formula, so a replay is byte-identical across processes.
import { checkedMul, roundToInt } from "@bluewave/contracts";
import { DOCK_MASS_LIMIT_KEYS, type DockMassLimitKey } from "./dock.js";

/** The stable policy identifier DESIGN-16 section 5.1 requires. */
export const DOCK_EXPANSION_POLICY_ID = "dock_expansion_v1" as const;

/** The stable formula version recorded with a project's locked step (DESIGN-16 section 5.1 `formula version`). */
export const DOCK_EXPANSION_FORMULA_VERSION = "dock_expansion_v1" as const;

/** The shipped `baseDurationMonths`: exactly 12 completed strategic months (DESIGN-16 section 5.1). */
export const DOCK_EXPANSION_BASE_DURATION_MONTHS = 12 as const;

/** DESIGN-16 section 5.1: a selected `baseDurationMonths` MUST stay within `9..18` months inclusive. */
export const DOCK_EXPANSION_PERMITTED_MIN_DURATION_MONTHS = 9 as const;
export const DOCK_EXPANSION_PERMITTED_MAX_DURATION_MONTHS = 18 as const;

/** DESIGN-16 section 5.3: `finalDurationMonths = clamp(6, 24, ceiling(baseDurationMonths * multiplierBp / 10_000))`. */
export const DOCK_EXPANSION_CLAMP_MIN_DURATION_MONTHS = 6 as const;
export const DOCK_EXPANSION_CLAMP_MAX_DURATION_MONTHS = 24 as const;

/** The shipped neutral duration multiplier: `10_000` basis points (DESIGN-16 section 5.3). */
export const DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP = 10_000 as const;

/** DESIGN-16 section 5.2: one era of the expansion step schedule, in canonical kilograms. */
export interface DockExpansionEraStep {
  readonly fromYear: number;
  /** Inclusive last year of the era. */
  readonly throughYear: number;
  readonly stepKg: number;
}

/**
 * DESIGN-16 section 5.2: the era-step schedule. Each completed expansion raises every covered dock mass limit by the
 * era's exact step, in kilograms (one metric tonne is exactly 1_000 kg under DESIGN-07).
 */
export const DOCK_EXPANSION_ERA_STEPS: readonly DockExpansionEraStep[] = [
  { fromYear: 1880, throughYear: 1899, stepKg: 1_000_000 },
  { fromYear: 1900, throughYear: 1919, stepKg: 1_250_000 },
  { fromYear: 1920, throughYear: 1939, stepKg: 1_500_000 },
  { fromYear: 1940, throughYear: 1959, stepKg: 1_750_000 },
  { fromYear: 1960, throughYear: 1970, stepKg: 2_000_000 },
] as const;

/** DESIGN-16 section 5.2: the permitted step range, `1_000_000..2_000_000` kilograms inclusive. */
export const DOCK_EXPANSION_PERMITTED_MIN_STEP_KG = 1_000_000 as const;
export const DOCK_EXPANSION_PERMITTED_MAX_STEP_KG = 2_000_000 as const;

/** DESIGN-16 section 8: dock expansion books to the `INFRASTRUCTURE` pool when present. */
export const DOCK_EXPANSION_CONSTRUCTION_CAPACITY_POOL = "INFRASTRUCTURE" as const;

/**
 * DESIGN-16 section 5.1: the fields the active ruleset MUST define for `dock_expansion_v1`. Duration-modifier
 * definitions are represented by their versioned neutral multiplier here; the full modifier registry stays a
 * content concern, and a missing modifier is a hard failure under DESIGN-16 section 5.3.
 */
export interface DockExpansionPolicy {
  readonly policyId: typeof DOCK_EXPANSION_POLICY_ID;
  readonly baseDurationMonths: number;
  readonly eraSteps: readonly DockExpansionEraStep[];
  readonly neutralDurationMultiplierBp: number;
  readonly constructionCapacityPool: typeof DOCK_EXPANSION_CONSTRUCTION_CAPACITY_POOL;
  /** `finalDurationMonths` rounds the daily multiplier product up before clamping (DESIGN-16 section 5.3). */
  readonly durationRoundingMode: "ceil";
  readonly formulaVersion: typeof DOCK_EXPANSION_FORMULA_VERSION;
}

/** The shipped `dock_expansion_v1` ruleset (DESIGN-16 section 5). */
export const DOCK_EXPANSION_V1: DockExpansionPolicy = {
  policyId: DOCK_EXPANSION_POLICY_ID,
  baseDurationMonths: DOCK_EXPANSION_BASE_DURATION_MONTHS,
  eraSteps: DOCK_EXPANSION_ERA_STEPS,
  neutralDurationMultiplierBp: DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP,
  constructionCapacityPool: DOCK_EXPANSION_CONSTRUCTION_CAPACITY_POOL,
  durationRoundingMode: "ceil",
  formulaVersion: DOCK_EXPANSION_FORMULA_VERSION,
};

/** The year part of a `YYYY-MM` campaign month id, or `null` when malformed. */
function campaignYear(campaignMonth: string): number | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(campaignMonth);
  return match === null ? null : Number(match[1]);
}

/** The four dock mass limits a completed expansion raises (DESIGN-16 section 4.1/5.2). */
export type DockMassLimits = Readonly<Record<DockMassLimitKey, number>>;

/**
 * DESIGN-16 section 5.2: the era step for a calendar year, or `null` when the year is outside the authored schedule.
 * Failing closed (rather than guessing) keeps a year with no declared era from silently expanding a dock.
 */
export function dockExpansionEraStepKg(year: number): number | null {
  const era = DOCK_EXPANSION_ERA_STEPS.find(
    (e) => Number.isSafeInteger(year) && year >= e.fromYear && year <= e.throughYear,
  );
  return era === undefined ? null : era.stepKg;
}

/**
 * DESIGN-16 section 5.2: the era step locked in at authorization. The returned value is the one the project stores;
 * later calendar advancement MUST NOT change it (the caller persists it, never re-resolves it per month).
 */
export function dockExpansionEraStepForMonth(campaignMonth: string): number | null {
  const year = campaignYear(campaignMonth);
  return year === null ? null : dockExpansionEraStepKg(year);
}

/** DESIGN-16 section 5.1: whether a selected `baseDurationMonths` is within the permitted `9..18` range. */
export function isPermittedDockExpansionDurationMonths(months: number): boolean {
  return (
    Number.isSafeInteger(months) &&
    months >= DOCK_EXPANSION_PERMITTED_MIN_DURATION_MONTHS &&
    months <= DOCK_EXPANSION_PERMITTED_MAX_DURATION_MONTHS
  );
}

/**
 * DESIGN-16 section 5.1: a selected `baseDurationMonths` is explicit and versioned; a value outside `9..18` MUST be
 * refused rather than silently clamped, so a bad ruleset cannot quietly alter expansion timing.
 */
export function assertPermittedDockExpansionDurationMonths(months: number): void {
  if (!isPermittedDockExpansionDurationMonths(months))
    throw new RangeError(
      `baseDurationMonths ${String(months)} is outside the permitted ${String(
        DOCK_EXPANSION_PERMITTED_MIN_DURATION_MONTHS,
      )}..${String(DOCK_EXPANSION_PERMITTED_MAX_DURATION_MONTHS)} range`,
    );
}

/**
 * DESIGN-16 section 5.3: `finalDurationMonths = clamp(6, 24, ceiling(baseDurationMonths * multiplierBp / 10_000))`.
 * The multiplication is checked and the ceiling is applied before the clamp, exactly as the contract orders it.
 */
export function dockExpansionFinalDurationMonths(
  baseDurationMonths: number,
  durationMultiplierBp: number,
): number {
  if (!Number.isSafeInteger(baseDurationMonths) || baseDurationMonths <= 0)
    throw new RangeError(
      `baseDurationMonths must be a positive safe integer, got ${String(baseDurationMonths)}`,
    );
  if (!Number.isSafeInteger(durationMultiplierBp) || durationMultiplierBp <= 0)
    throw new RangeError(
      `durationMultiplierBp must be a positive safe integer, got ${String(durationMultiplierBp)}`,
    );
  const scaled = roundToInt(checkedMul(baseDurationMonths, durationMultiplierBp) / 10_000, "ceil");
  return Math.min(
    DOCK_EXPANSION_CLAMP_MAX_DURATION_MONTHS,
    Math.max(DOCK_EXPANSION_CLAMP_MIN_DURATION_MONTHS, scaled),
  );
}

/**
 * DESIGN-16 section 5.2: raise every covered dock mass limit by the era's exact step. Every limit moves by the same
 * step, and the addition is checked; a project never copies one limit onto another (DESIGN-16 section 4.1).
 */
export function raiseDockLimitsByStep(limits: DockMassLimits, stepKg: number): DockMassLimits {
  if (!Number.isSafeInteger(stepKg) || stepKg <= 0)
    throw new RangeError(`expansion stepKg must be a positive safe integer, got ${String(stepKg)}`);
  const raised = {} as Record<DockMassLimitKey, number>;
  for (const key of DOCK_MASS_LIMIT_KEYS) {
    const value = limits[key];
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new RangeError(
        `dock limit ${key} must be a positive safe integer, got ${String(value)}`,
      );
    raised[key] = checkedAddSafe(key, value, stepKg);
  }
  return raised;
}

/** `value + step` with an explicit overflow message, reusing `checkedMul`-style safe-integer discipline. */
function checkedAddSafe(label: string, value: number, step: number): number {
  const result = value + step;
  if (!Number.isSafeInteger(result))
    throw new RangeError(`${label} + step overflowed the safe-integer range`);
  return result;
}
