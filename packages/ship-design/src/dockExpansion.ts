import { checkedMul, roundToInt } from "@bluewave/contracts";
import { DOCK_MASS_LIMIT_KEYS, type DockMassLimitKey } from "./dock.js";
import { designInvariant } from "./errors.js";

export const DOCK_EXPANSION_POLICY_ID = "dock_expansion_v1" as const;

export const DOCK_EXPANSION_FORMULA_VERSION = "dock_expansion_v1" as const;

export const DOCK_EXPANSION_BASE_DURATION_MONTHS = 12 as const;

export const DOCK_EXPANSION_PERMITTED_MIN_DURATION_MONTHS = 9 as const;
export const DOCK_EXPANSION_PERMITTED_MAX_DURATION_MONTHS = 18 as const;

export const DOCK_EXPANSION_CLAMP_MIN_DURATION_MONTHS = 6 as const;
export const DOCK_EXPANSION_CLAMP_MAX_DURATION_MONTHS = 24 as const;

export const DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP = 10_000 as const;

export interface DockExpansionEraStep {
  readonly fromYear: number;
  readonly throughYear: number;
  readonly stepKg: number;
}

export const DOCK_EXPANSION_ERA_STEPS: readonly DockExpansionEraStep[] = [
  { fromYear: 1880, throughYear: 1899, stepKg: 1_000_000 },
  { fromYear: 1900, throughYear: 1919, stepKg: 1_250_000 },
  { fromYear: 1920, throughYear: 1939, stepKg: 1_500_000 },
  { fromYear: 1940, throughYear: 1959, stepKg: 1_750_000 },
  { fromYear: 1960, throughYear: 1970, stepKg: 2_000_000 },
] as const;

export const DOCK_EXPANSION_PERMITTED_MIN_STEP_KG = 1_000_000 as const;
export const DOCK_EXPANSION_PERMITTED_MAX_STEP_KG = 2_000_000 as const;

export const DOCK_EXPANSION_CONSTRUCTION_CAPACITY_POOL = "INFRASTRUCTURE" as const;

export interface DockExpansionPolicy {
  readonly policyId: typeof DOCK_EXPANSION_POLICY_ID;
  readonly baseDurationMonths: number;
  readonly eraSteps: readonly DockExpansionEraStep[];
  readonly neutralDurationMultiplierBp: number;
  readonly constructionCapacityPool: typeof DOCK_EXPANSION_CONSTRUCTION_CAPACITY_POOL;
  readonly durationRoundingMode: "ceil";
  readonly formulaVersion: typeof DOCK_EXPANSION_FORMULA_VERSION;
}

export const DOCK_EXPANSION_V1: DockExpansionPolicy = {
  policyId: DOCK_EXPANSION_POLICY_ID,
  baseDurationMonths: DOCK_EXPANSION_BASE_DURATION_MONTHS,
  eraSteps: DOCK_EXPANSION_ERA_STEPS,
  neutralDurationMultiplierBp: DOCK_EXPANSION_NEUTRAL_DURATION_MULTIPLIER_BP,
  constructionCapacityPool: DOCK_EXPANSION_CONSTRUCTION_CAPACITY_POOL,
  durationRoundingMode: "ceil",
  formulaVersion: DOCK_EXPANSION_FORMULA_VERSION,
};

function campaignYear(campaignMonth: string): number | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(campaignMonth);
  return match === null ? null : Number(match[1]);
}

export type DockMassLimits = Readonly<Record<DockMassLimitKey, number>>;

export function dockExpansionEraStepKg(year: number): number | null {
  const era = DOCK_EXPANSION_ERA_STEPS.find(
    (e) => Number.isSafeInteger(year) && year >= e.fromYear && year <= e.throughYear,
  );
  return era === undefined ? null : era.stepKg;
}

export function dockExpansionEraStepForMonth(campaignMonth: string): number | null {
  const year = campaignYear(campaignMonth);
  return year === null ? null : dockExpansionEraStepKg(year);
}

export function isPermittedDockExpansionDurationMonths(months: number): boolean {
  return (
    Number.isSafeInteger(months) &&
    months >= DOCK_EXPANSION_PERMITTED_MIN_DURATION_MONTHS &&
    months <= DOCK_EXPANSION_PERMITTED_MAX_DURATION_MONTHS
  );
}

export function assertPermittedDockExpansionDurationMonths(months: number): void {
  if (!isPermittedDockExpansionDurationMonths(months))
    throw designInvariant(
      `baseDurationMonths ${String(months)} is outside the permitted ${String(
        DOCK_EXPANSION_PERMITTED_MIN_DURATION_MONTHS,
      )}..${String(DOCK_EXPANSION_PERMITTED_MAX_DURATION_MONTHS)} range`,
    );
}

export function dockExpansionFinalDurationMonths(
  baseDurationMonths: number,
  durationMultiplierBp: number,
): number {
  if (!Number.isSafeInteger(baseDurationMonths) || baseDurationMonths <= 0)
    throw designInvariant(
      `baseDurationMonths must be a positive safe integer, got ${String(baseDurationMonths)}`,
    );
  if (!Number.isSafeInteger(durationMultiplierBp) || durationMultiplierBp <= 0)
    throw designInvariant(
      `durationMultiplierBp must be a positive safe integer, got ${String(durationMultiplierBp)}`,
    );
  const scaled = roundToInt(checkedMul(baseDurationMonths, durationMultiplierBp) / 10_000, "ceil");
  return Math.min(
    DOCK_EXPANSION_CLAMP_MAX_DURATION_MONTHS,
    Math.max(DOCK_EXPANSION_CLAMP_MIN_DURATION_MONTHS, scaled),
  );
}

export function raiseDockLimitsByStep(limits: DockMassLimits, stepKg: number): DockMassLimits {
  if (!Number.isSafeInteger(stepKg) || stepKg <= 0)
    throw designInvariant(
      `expansion stepKg must be a positive safe integer, got ${String(stepKg)}`,
    );
  const raised = {} as Record<DockMassLimitKey, number>;
  for (const key of DOCK_MASS_LIMIT_KEYS) {
    const value = limits[key];
    if (!Number.isSafeInteger(value) || value <= 0)
      throw designInvariant(
        `dock limit ${key} must be a positive safe integer, got ${String(value)}`,
      );
    raised[key] = checkedAddSafe(key, value, stepKg);
  }
  return raised;
}

function checkedAddSafe(label: string, value: number, step: number): number {
  const result = value + step;
  if (!Number.isSafeInteger(result))
    throw designInvariant(`${label} + step overflowed the safe-integer range`);
  return result;
}
