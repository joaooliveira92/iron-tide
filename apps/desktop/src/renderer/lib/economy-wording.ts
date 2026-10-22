import type { EconomyStatus, ResearchUnfundedReason } from "@bluewave/campaign-engine";

import { formatCount } from "./presentation-format/index.js";

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
