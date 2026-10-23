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

export function formatTimestamp(
  timestamp: string,
  options: { readonly locale: FormattingLocale; readonly style: TimestampStyle },
): string {
  const clock = { hour: "numeric", minute: "numeric", second: "numeric" } as const;
  const calendar = { year: "numeric", month: "numeric", day: "numeric" } as const;
  return new Intl.DateTimeFormat(
    options.locale,
    options.style === "time" ? clock : { ...calendar, ...clock },
  ).format(new Date(timestamp));
}

export function formatCampaignMonth(
  month: CampaignMonth,
  options: { readonly locale: FormattingLocale; readonly style?: MonthNameStyle },
): string {
  const name = localizedMonthName(month.month, options.locale, options.style ?? "long");
  const year = new Intl.NumberFormat(options.locale, { useGrouping: false }).format(month.year);
  return name === undefined ? `${month.month} ${year}` : `${name} ${year}`;
}
