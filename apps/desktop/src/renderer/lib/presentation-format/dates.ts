/**
 * Campaign-date formatting (U-3 map D5). Campaign time is a canonical integer
 * `(year, month)` with no wall clock (ADR-0215), so dates format from those
 * integers — never a `Date` — through the chosen formatting locale. The month
 * vocabulary lives here once, replacing the per-screen `campaign-month.ts` names.
 *
 * UI language and formatting locale stay separate (ADR-0209): this module only
 * takes the locale.
 */
import type { FormattingLocale } from "../../../shared/preferences-contract.js";

export interface CampaignMonth {
  readonly year: number;
  readonly month: number;
}

export type MonthNameStyle = "long" | "short";

interface MonthCatalogue {
  readonly long: readonly string[];
  readonly short: readonly string[];
}

/**
 * Month names per formatting locale. A locale is only offered in Options when it
 * has automated formatting tests (ADR-0209), so this table grows with the allowlist;
 * `en-US` is the complete fallback.
 */
const MONTH_CATALOGUES: Readonly<Record<FormattingLocale, MonthCatalogue>> = {
  "en-US": {
    long: [
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
    ],
    short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },
};

function catalogueFor(locale: FormattingLocale): MonthCatalogue {
  return MONTH_CATALOGUES[locale] ?? MONTH_CATALOGUES["en-US"];
}

/** The localized month name for a 1-based month; undefined when out of range. */
export function localizedMonthName(
  month: number,
  locale: FormattingLocale,
  style: MonthNameStyle = "long",
): string | undefined {
  return catalogueFor(locale)[style][month - 1];
}

/**
 * "January 1880" (or "Jan 1880") from the canonical month. Falls back to the
 * numeric month when it is out of range, never a blank; the year is never grouped.
 */
export function formatCampaignMonth(
  month: CampaignMonth,
  options: { readonly locale: FormattingLocale; readonly style?: MonthNameStyle },
): string {
  const name = localizedMonthName(month.month, options.locale, options.style ?? "long");
  const year = new Intl.NumberFormat(options.locale, { useGrouping: false }).format(month.year);
  return name === undefined ? `${month.month} ${year}` : `${name} ${year}`;
}
