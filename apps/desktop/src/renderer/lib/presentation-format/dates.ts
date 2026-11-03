import type { FormattingLocale } from "../../../shared/preferences-contract.js";
import { cachedDateTimeFormat, cachedNumberFormat } from "./intl-cache.js";

export interface CampaignMonth {
  readonly year: number;
  readonly month: number;
}

export type MonthNameStyle = "long" | "short";

interface MonthCatalogue {
  readonly long: readonly string[];
  readonly short: readonly string[];
}

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

export function localizedMonthName(
  month: number,
  locale: FormattingLocale,
  style: MonthNameStyle = "long",
): string | undefined {
  return catalogueFor(locale)[style][month - 1];
}

export type TimestampStyle = "time" | "dateTime";

const CLOCK_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
};

const CALENDAR_CLOCK_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
};

const UNGROUPED_YEAR_OPTIONS: Intl.NumberFormatOptions = { useGrouping: false };

export function formatTimestamp(
  timestamp: string,
  options: { readonly locale: FormattingLocale; readonly style: TimestampStyle },
): string {
  return cachedDateTimeFormat(
    options.locale,
    options.style === "time" ? CLOCK_OPTIONS : CALENDAR_CLOCK_OPTIONS,
  ).format(new Date(timestamp));
}

export function formatCampaignMonth(
  month: CampaignMonth,
  options: { readonly locale: FormattingLocale; readonly style?: MonthNameStyle },
): string {
  const name = localizedMonthName(month.month, options.locale, options.style ?? "long");
  const year = cachedNumberFormat(options.locale, UNGROUPED_YEAR_OPTIONS).format(month.year);
  return name === undefined ? `${month.month} ${year}` : `${name} ${year}`;
}
