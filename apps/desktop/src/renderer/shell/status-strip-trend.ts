import { formatCampaignMonth } from "../lib/presentation-format/index.js";
import { formatMoney } from "./status-strip-state.js";

/**
 * Month-over-month trend for the strip's treasury and balance cards, read from the stored monthly
 * reports (`readMonthlyReports`): each is the real record of a month the player already advanced.
 * Nothing here is projected or invented. With no stored month there is no trend, and the cards
 * say nothing about one rather than draw a flat line.
 */

/** How many advanced months the trend looks back over. */
export const TREND_MONTHS = 6;

export type TrendDirection = "up" | "down" | "flat";

export interface TrendSeries {
  /** Oldest first. */
  readonly values: readonly number[];
  /** One label per value, e.g. "Feb 1880". */
  readonly labels: readonly string[];
  /** The latest value, formatted. */
  readonly current: string;
  /** Change from the previous value as a signed amount; null with fewer than two values. */
  readonly delta: string | null;
  readonly direction: TrendDirection | null;
}

export interface TrendDetail {
  /** Months of reports behind the trend. */
  readonly months: number;
  /** Treasury at the start of the oldest month, then at the close of each month. */
  readonly treasury: TrendSeries;
  /** What each month actually netted (closing less opening treasury), construction included. */
  readonly net: TrendSeries;
}

/** The part of a stored monthly report the trend reads. */
export interface TrendReport {
  readonly period: {
    readonly from: { readonly year: number; readonly month: number };
    readonly to: { readonly year: number; readonly month: number };
  };
  readonly treasury: {
    readonly openingTreasury: number;
    readonly closingTreasury: number;
    readonly netChange: number;
  };
}

function signedMoney(value: number): string {
  return value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
}

function series(
  values: readonly number[],
  labels: readonly string[],
  format: (value: number) => string,
): TrendSeries {
  const last = values[values.length - 1];
  const previous = values[values.length - 2];
  const change = last !== undefined && previous !== undefined ? last - previous : null;
  return {
    values,
    labels,
    current: last === undefined ? "—" : format(last),
    delta: change === null ? null : signedMoney(change),
    direction: change === null ? null : change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

const month = (m: { readonly year: number; readonly month: number }) =>
  formatCampaignMonth(m, { locale: "en-US", style: "short" });

/**
 * @param reports stored monthly reports, newest first, or null when they could not be read
 * @returns the trend, or null when there is no completed month to draw one from
 */
export function buildTrend(reports: readonly TrendReport[] | null): TrendDetail | null {
  if (reports === null || reports.length === 0) return null;
  // Newest first on the way in; the series read oldest to newest.
  const recent = reports.slice(0, TREND_MONTHS).toReversed();
  const oldest = recent[0];
  if (oldest === undefined) return null;
  return {
    months: recent.length,
    treasury: series(
      [oldest.treasury.openingTreasury, ...recent.map((r) => r.treasury.closingTreasury)],
      [month(oldest.period.from), ...recent.map((r) => month(r.period.to))],
      formatMoney,
    ),
    net: series(
      recent.map((r) => r.treasury.netChange),
      recent.map((r) => month(r.period.from)),
      signedMoney,
    ),
  };
}
