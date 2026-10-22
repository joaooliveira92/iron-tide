import type { PlayerProjection } from "@bluewave/campaign-engine";
import { formatMonthYear } from "../../../lib/campaign-month.js";

export function formatDate(month: PlayerProjection["month"]): string {
  return formatMonthYear(month);
}
