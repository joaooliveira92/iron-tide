import type { TooltipDetailPreference } from "../../shared/preferences-contract.js";
import { usePreferences } from "../lib/preferences-context.js";

/**
 * Tooltip-detail accessors (U-4 map D4). The stored `tooltipDetail` preference
 * decides whether a surface shows its explanatory tooltip: `minimal` suppresses,
 * `standard` and `detailed` show it. Components read the preference through here
 * so the control is consumed, not inert.
 */

export function shouldShowTooltip(detail: TooltipDetailPreference): boolean {
  return detail !== "minimal";
}

/** The title to attach, or undefined when the detail setting suppresses tooltips. */
export function tooltipTitle(detail: TooltipDetailPreference, text: string): string | undefined {
  return shouldShowTooltip(detail) ? text : undefined;
}

/** Read the stored tooltip-detail preference. */
export function useTooltipDetail(): TooltipDetailPreference {
  return usePreferences().preferences.tooltipDetail;
}
