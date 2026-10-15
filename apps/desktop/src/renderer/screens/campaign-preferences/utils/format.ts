import type { PlayerProjection } from "@bluewave/campaign-engine";
import { formatMonthYear } from "../../../lib/campaign-month.js";

/** "January 1880"; a month outside 1–12 falls back to its number, never a blank. */
export function formatDate(month: PlayerProjection["month"]): string {
  return formatMonthYear(month);
}
