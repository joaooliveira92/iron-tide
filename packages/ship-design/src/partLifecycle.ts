const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(month: string): boolean {
  return MONTH_RE.test(month);
}

function monthIndex(month: string): number {
  if (!MONTH_RE.test(month)) {
    throw new Error(`partLifecycle: '${month}' is not a YYYY-MM month`);
  }
  return Number(month.slice(0, 4)) * 12 + (Number(month.slice(5, 7)) - 1);
}

function monthAt(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number): string {
  return monthAt(monthIndex(month) + delta);
}

export type LifecycleStatus = "NOT_YET_AVAILABLE" | "AVAILABLE" | "UNAVAILABLE";

export function lifecycleStatus(
  lifecycle: {
    readonly availableFrom: string;
    readonly availableUntil?: string | null | undefined;
  },
  month: string,
): LifecycleStatus {
  if (month < lifecycle.availableFrom) return "NOT_YET_AVAILABLE";
  const until = lifecycle.availableUntil;
  return until != null && month >= until ? "UNAVAILABLE" : "AVAILABLE";
}

export function availableUntilFromRetirementMonth(
  retirementMonth: string | null | undefined,
): string | null {
  return retirementMonth == null ? null : monthAt(monthIndex(retirementMonth) + 1);
}

export function retirementMonthFromAvailableUntil(
  availableUntil: string | null | undefined,
): string | null {
  return availableUntil == null ? null : monthAt(monthIndex(availableUntil) - 1);
}

export function lifecycleIssue(
  availableFrom: string | undefined,
  availableUntil: string | null | undefined,
): string | null {
  if (availableFrom === undefined) return "no introduction month";
  if (!MONTH_RE.test(availableFrom))
    return `introduction '${availableFrom}' is not a YYYY-MM month`;
  if (availableUntil == null) return null;
  if (!MONTH_RE.test(availableUntil)) return `end '${availableUntil}' is not a YYYY-MM month`;
  return monthIndex(availableUntil) > monthIndex(availableFrom)
    ? null
    : `availability ends (${availableUntil}) no later than it starts (${availableFrom})`;
}
