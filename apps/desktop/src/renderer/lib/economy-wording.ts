import type { EconomyStatus, ResearchUnfundedReason } from "@bluewave/campaign-engine";

import { resolveMessage } from "../content/uiCatalogue.js";
import { formatCount } from "./presentation-format/format.js";

export function economyStatusLabel(status: EconomyStatus): string {
  return resolveMessage(`economy.status.${status}`);
}

export function researchNote(breakdown: {
  readonly researchCap: number;
  readonly researchRequested: number;
  readonly researchUnfundedReason: ResearchUnfundedReason | undefined;
}): string | null {
  if (breakdown.researchUnfundedReason === "NO_ELIGIBLE_RESEARCH_FIELD")
    return resolveMessage("economy.research.noField", {
      requested: formatCount(breakdown.researchRequested),
    });
  if (breakdown.researchUnfundedReason === "ABOVE_CAP")
    return resolveMessage("economy.research.aboveCap", {
      requested: formatCount(breakdown.researchRequested),
      cap: formatCount(breakdown.researchCap),
    });
  if (breakdown.researchCap === 0) return resolveMessage("economy.research.capZero");
  return null;
}
