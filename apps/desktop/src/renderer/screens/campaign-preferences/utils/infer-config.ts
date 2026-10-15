import type { PlayerProjection } from "@bluewave/campaign-engine";
import type { CampaignConfigDisplay } from "../types.js";

export function inferConfig(projection: PlayerProjection): CampaignConfigDisplay {
  const treasury = projection.economy.treasury;
  return {
    continuityMode: treasury > 500_000 ? "Historical" : "Alternate",
    fleetSize:
      projection.fleet.reduce((s, f) => s + f.divisions.length, 0) > 6 ? "Large" : "Standard",
    researchSpeed: projection.knownTechnologyIds.length > 10 ? "Accelerated" : "Normal",
    technologyVariation: "Low",
    historicalBudget:
      treasury > 800_000 ? "Surplus" : treasury > 300_000 ? "Balanced" : "Austerity",
    legacyFleetMode: "Retired",
    tacticalRealism: "Standard",
    difficulty: treasury > 800_000 ? "Easy" : treasury > 300_000 ? "Normal" : "Hard",
  };
}
