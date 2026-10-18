import type { EconomyStatus, ResearchUnfundedReason } from "@bluewave/campaign-engine";

import { formatCount } from "./presentation-format/index.js";

/** The one label for a treasury status band; the Treasury screen and the status strip both read it. */
export function economyStatusLabel(status: EconomyStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "narrow":
      return "Narrow";
    case "deficit":
      return "Deficit";
    case "critical":
      return "Critical";
  }
}

/**
 * Why a standing research budget is not (fully) paid, or why there is none to pay — always stated, never a silent zero.
 * Returns null when nothing needs saying.
 */
export function researchNote(breakdown: {
  readonly researchCap: number;
  readonly researchRequested: number;
  readonly researchUnfundedReason: ResearchUnfundedReason | undefined;
}): string | null {
  if (breakdown.researchUnfundedReason === "NO_ELIGIBLE_RESEARCH_FIELD")
    return `Research of ${formatCount(breakdown.researchRequested)} is set but no field can take it, so nothing is paid.`;
  if (breakdown.researchUnfundedReason === "ABOVE_CAP")
    return `Research of ${formatCount(breakdown.researchRequested)} is above the cap of ${formatCount(breakdown.researchCap)} (12% of the monthly appropriation).`;
  if (breakdown.researchCap === 0)
    return "The naval appropriation is too small to fund research: the cap is 12% of it.";
  return null;
}
