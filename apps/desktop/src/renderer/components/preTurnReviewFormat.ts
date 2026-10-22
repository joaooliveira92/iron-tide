import { formatMonthYear } from "../lib/campaign-month.js";

/** "Mar 1900"; falls back to the numeric month when out of range, never a blank. */
export function formatMonth(month: { readonly year: number; readonly month: number }): string {
  return formatMonthYear(month, "short");
}

/**
 * A figure the engine may not have supplied yet: the value once present, "…"
 * while loading, and "—" once the load has failed. The formatter is injected
 * (`PresentationFormat.money`/`.count`) so every figure reuses the one seam and
 * never re-derives number or currency formatting here.
 */
export function formatOptional(
  value: number | null,
  loading: boolean,
  format: (value: number) => string,
): string {
  if (value !== null) return format(value);
  return loading ? "…" : "—";
}
