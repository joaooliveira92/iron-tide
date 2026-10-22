import type { TooltipDetailPreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";

export function shouldShowTooltip(detail: TooltipDetailPreference): boolean {
  return detail !== "minimal";
}

export function tooltipTitle(detail: TooltipDetailPreference, text: string): string | undefined {
  return shouldShowTooltip(detail) ? text : undefined;
}

export function useTooltipDetail(): TooltipDetailPreference {
  return usePreferences().preferences.tooltipDetail;
}
