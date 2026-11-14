import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { formatMonthYear } from "../../lib/campaign-month.js";

export function monthLabel(month: { readonly year: number; readonly month: number }): string {
  return formatMonthYear(month);
}

export function signed(value: number, format: PresentationFormat): string {
  if (value === 0) return "0";
  const body = format.count(Math.abs(value));
  return value > 0 ? `+${body}` : `−${body}`;
}
