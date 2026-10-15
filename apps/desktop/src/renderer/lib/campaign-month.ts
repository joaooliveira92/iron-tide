/**
 * The one place the campaign's month vocabulary lives. Engine months are
 * 1-based (`{ year, month }`); every screen that prints "January 1880" or
 * "Jan 1880" reads the names from here so the wording cannot drift between
 * the toolbar, the pre-turn review, the month report and the setup wizard.
 *
 * Display only — never use a name as a key or compare it to engine data.
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type MonthNameStyle = "long" | "short";

/** The month's name (1-based); undefined when the month is outside 1–12, so callers pick their own fallback. */
export function monthName(month: number, style: MonthNameStyle = "long"): string | undefined {
  const names: readonly string[] = style === "short" ? MONTH_NAMES_SHORT : MONTH_NAMES;
  return names[month - 1];
}

/**
 * "January 1880" (or "Jan 1880"), falling back to the numeric month when it is
 * out of range — never a blank.
 */
export function formatMonthYear(
  month: { readonly year: number; readonly month: number },
  style: MonthNameStyle = "long",
): string {
  const name = monthName(month.month, style);
  return `${name ?? month.month} ${month.year}`;
}
