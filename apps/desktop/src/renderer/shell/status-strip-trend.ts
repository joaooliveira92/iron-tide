import { formatCampaignMonth } from "../lib/presentation-format/dates.js";
import type { PresentationFormat } from "../lib/presentation-format/index.js";

export const TREND_MONTHS = 6;

export type TrendDirection = "up" | "down" | "flat";

export interface TrendSeries {
  readonly values: readonly number[];
  readonly labels: readonly string[];
  readonly current: string;
  readonly delta: string | null;
  readonly direction: TrendDirection | null;
}

export interface TrendDetail {
  readonly months: number;
  readonly treasury: TrendSeries;
  readonly net: TrendSeries;
}

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

function signedMoney(value: number, format: PresentationFormat): string {
  return value > 0 ? `+${format.money(value)}` : format.money(value);
}

function series(
  values: readonly number[],
  labels: readonly string[],
  format: (value: number) => string,
  signed: (value: number) => string,
): TrendSeries {
  const last = values[values.length - 1];
  const previous = values[values.length - 2];
  const change = last !== undefined && previous !== undefined ? last - previous : null;
  return {
    values,
    labels,
    current: last === undefined ? "—" : format(last),
    delta: change === null ? null : signed(change),
    direction: change === null ? null : change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

export function buildTrend(
  reports: readonly TrendReport[] | null,
  format: PresentationFormat,
): TrendDetail | null {
  if (reports === null || reports.length === 0) return null;
  const recent = reports.slice(0, TREND_MONTHS).toReversed();
  const oldest = recent[0];
  if (oldest === undefined) return null;
  const money = format.money;
  const month = (m: { readonly year: number; readonly month: number }) =>
    formatCampaignMonth(m, { locale: format.locale, style: "short" });
  return {
    months: recent.length,
    treasury: series(
      [oldest.treasury.openingTreasury, ...recent.map((r) => r.treasury.closingTreasury)],
      [month(oldest.period.from), ...recent.map((r) => month(r.period.to))],
      money,
      (value) => signedMoney(value, format),
    ),
    net: series(
      recent.map((r) => r.treasury.netChange),
      recent.map((r) => month(r.period.from)),
      (value) => signedMoney(value, format),
      (value) => signedMoney(value, format),
    ),
  };
}
