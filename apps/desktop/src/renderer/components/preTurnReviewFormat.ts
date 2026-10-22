import { formatMonthYear } from "../lib/campaign-month.js";

export function formatMonth(month: { readonly year: number; readonly month: number }): string {
  return formatMonthYear(month, "short");
}

export function formatOptional(
  value: number | null,
  loading: boolean,
  format: (value: number) => string,
): string {
  if (value !== null) return format(value);
  return loading ? "…" : "—";
}
