// packages/campaign/src/timeline.ts
// DESIGN-03 §2 Simulation Timeline - Normative
import type { DiagnosticCollector } from "@bluewave/diagnostics";
export const SIMULATION_END_YEAR = 1970 as const;
export const SIMULATION_END_MONTH = 12 as const;

// B-6/ADR-0025: the canonical start calendar date for campaigns compiled
// without an explicit scenario / campaignStart input — the first canonical
// scenario's start (scen_1880, DESIGN-03 §1). The CampaignCompiler always
// stamps explicit startYear/startMonth on the compiled snapshot (scenario ->
// start date when a campaignConfiguration is supplied, the campaignStart input
// if given, else this default); the phase engine derives every campaign month
// id from the snapshot's own start fields, so this constant is never read from
// ambient time/env/locale.
export const DEFAULT_CAMPAIGN_START_YEAR = 1880 as const;
export const DEFAULT_CAMPAIGN_START_MONTH = 1 as const;

/** Canonical month-id encoding (e.g. (1880, 2) -> "1880-02"). Zero-padded, integer arithmetic only. */
export function monthId(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/**
 * DESIGN-03 §2 campaign month id for a turn: exactly
 * `fromLinear(toLinear(startYear, startMonth) + turnNumber)` rendered `YYYY-MM`
 * (e.g. campaign starting January 1880 at turn 1 -> "1880-02"). Deterministic:
 * no wall-clock/env/locale. The weather stream domain is
 * `campaign/weather/<areaId>/<month>` with this month id (DESIGN-42 §1).
 */
export function campaignMonthId(startYear: number, startMonth: number, turnNumber: number): string {
  const d = fromLinear(toLinear(startYear, startMonth) + turnNumber);
  return monthId(d.year, d.month);
}
export function toLinear(year: number, month: number): number {
  return year * 12 + (month - 1);
}
export function fromLinear(l: number): { year: number; month: number } {
  return { year: Math.floor(l / 12), month: (l % 12) + 1 };
}
export const TURN_DURATION_MONTHS = 1 as const;
export function advanceMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  return fromLinear(toLinear(year, month) + delta);
}
export function isAtEnd(year: number, month: number): boolean {
  return year === SIMULATION_END_YEAR && month === SIMULATION_END_MONTH;
}
export function isBeyondEnd(year: number, month: number): boolean {
  return toLinear(year, month) > toLinear(SIMULATION_END_YEAR, SIMULATION_END_MONTH);
}
export function canAdvance(year: number, month: number): boolean {
  return !isAtEnd(year, month) && !isBeyondEnd(year, month);
}
/**
 * §2: Must complete Dec 1970 then reject Jan 1971 with SIMULATION_END_REACHED.
 * Month advancement MUST be exactly 1 calendar month via integer arithmetic.
 */
export function assertCanAdvance(
  year: number,
  month: number,
  nextYear: number,
  nextMonth: number,
  c: DiagnosticCollector,
): boolean {
  const curLinear = toLinear(year, month);
  const nextLinear = toLinear(nextYear, nextMonth);
  const endLinear = toLinear(SIMULATION_END_YEAR, SIMULATION_END_MONTH);
  const expectedNext = curLinear + TURN_DURATION_MONTHS;
  if (isBeyondEnd(year, month)) {
    c.addError("SIMULATION_END_REACHED", "Current date already beyond December 1970", {
      stage: "timeline",
    });
    return false;
  }
  if (nextLinear > endLinear) {
    c.addError("SIMULATION_END_REACHED", "Campaign cannot advance beyond December 1970", {
      stage: "timeline",
    });
    return false;
  }
  if (nextLinear !== expectedNext) {
    c.addError(
      "INVALID_SCENARIO_DEFINITION",
      `Month advancement must be exactly ${TURN_DURATION_MONTHS} month, got ${nextLinear - curLinear}`,
      { stage: "timeline" },
    );
    return false;
  }
  return true;
}
export function validateMonth(year: number, month: number, c: DiagnosticCollector): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    c.addError("INVALID_SCENARIO_DEFINITION", `Invalid calendar month ${year}-${month}`, {
      stage: "timeline",
    });
    return false;
  }
  return true;
}
