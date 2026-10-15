/**
 * The availability boundary between today's catalogues and the part model (ship-part-model
 * SPM-R2; content-schema `PartLifecycleSchema`).
 *
 * The two representations disagree by exactly one month at the end of availability:
 * - legacy `retirementMonth` / `obsoleteMonth` is **inclusive** — the armament resolver
 *   still accepts the retirement month itself and blocks only the month after;
 * - part `lifecycle.availableUntil` is **exclusive** — the part is unavailable from that
 *   month on.
 *
 * So `availableUntil = retirementMonth + 1 month` and `retirementMonth = availableUntil − 1
 * month`; `null` (still available) maps to `null` both ways. `availableFrom` and
 * `introductionMonth` are both inclusive and copy unchanged.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Whether a string is a `YYYY-MM` month. */
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

/** The month `delta` months from `month` (`YYYY-MM`); throws for a malformed month. */
export function shiftMonth(month: string, delta: number): string {
  return monthAt(monthIndex(month) + delta);
}

/** Where a month falls against a part's availability window (`availableUntil` exclusive). */
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

/** The exclusive part `availableUntil` for an inclusive legacy retirement month. */
export function availableUntilFromRetirementMonth(
  retirementMonth: string | null | undefined,
): string | null {
  return retirementMonth == null ? null : monthAt(monthIndex(retirementMonth) + 1);
}

/** The inclusive legacy retirement month for an exclusive part `availableUntil`. */
export function retirementMonthFromAvailableUntil(
  availableUntil: string | null | undefined,
): string | null {
  return availableUntil == null ? null : monthAt(monthIndex(availableUntil) - 1);
}

/**
 * Why a legacy availability window cannot be a part `lifecycle`, or `null` when it can:
 * `availableFrom` must be a `YYYY-MM` month and an exclusive `availableUntil` must fall
 * after it (content-schema `PartLifecycleSchema`). Adapters report this as a coded read
 * failure instead of emitting a record the strict schema would reject.
 */
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
