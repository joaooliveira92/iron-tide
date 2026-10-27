import type { CampaignScreen } from "./campaign-screen-registry.js";

export const MAX_CLICK_DEPTH = 3;

export interface FeatureDepthEntry {
  readonly feature: string;
  readonly screen: CampaignScreen | null;
  readonly path: readonly string[];
  readonly planned?: true;
}

export const FEATURE_DEPTH: readonly FeatureDepthEntry[] = [
  { feature: "overview", screen: "overview", path: ["Overview"] },
  { feature: "world-map", screen: "overview", path: ["Overview"] },
  {
    feature: "ships-under-construction",
    screen: "construction",
    path: ["Construction", "Shipyard Ledger"],
  },
  { feature: "design-catalog", screen: "construction", path: ["Construction", "Design Catalog"] },
  { feature: "construction-commands", screen: "construction", path: ["Construction", "Commands"] },
  { feature: "fleet-movement", screen: "fleet", path: ["Fleet"] },
  { feature: "strategic-map", screen: "strategic-map", path: ["Map"] },
  { feature: "research", screen: "research", path: ["Research & Technology"] },
  { feature: "diplomacy", screen: "diplomacy", path: ["Diplomacy & War"] },
  { feature: "treasury", screen: "treasury", path: ["Treasury"] },
  { feature: "turn-report", screen: "simulation", path: ["Simulation & Turn", "Turn Report"] },
  {
    feature: "campaign-preferences",
    screen: "campaign-preferences",
    path: ["Campaign Preferences"],
  },
  { feature: "options", screen: "options", path: ["Options"] },
  { feature: "war-panel", screen: "diplomacy", path: ["Diplomacy & War"] },
  { feature: "intel", screen: "diplomacy", path: ["Diplomacy & War"] },
  { feature: "submarines", screen: "fleet", path: ["Fleet"] },
  { feature: "coastal-forts", screen: "construction", path: ["Construction", "Not yet modelled"] },
  {
    feature: "build-submarine",
    screen: "construction",
    path: ["Construction", "Not yet modelled"],
  },
  {
    feature: "build-fort-base",
    screen: "construction",
    path: ["Construction", "Not yet modelled"],
  },
  { feature: "fleet-losses", screen: "fleet", path: ["Fleet", "Losses"] },
  { feature: "ships-sunk-or-scrapped", screen: "diplomacy", path: ["Diplomacy & War"] },
  { feature: "area-overview", screen: "fleet", path: ["Fleet", "Area overview"] },
  { feature: "fleet-organization", screen: "fleet", path: ["Fleet"] },
  { feature: "air-groups", screen: "fleet", path: ["Fleet", "Not yet modelled"] },
  { feature: "aircraft-types", screen: "fleet", path: ["Fleet", "Not yet modelled"] },
  { feature: "officers", screen: "fleet", path: ["Fleet", "Officers"] },
  { feature: "doctrine", screen: null, planned: true, path: ["Research & Technology", "Doctrine"] },
  { feature: "mobilization", screen: null, planned: true, path: ["Treasury", "Mobilization"] },
  { feature: "fleet-exercise", screen: "fleet", path: ["Fleet", "Not yet modelled"] },
  { feature: "treaty-limits", screen: null, planned: true, path: ["Diplomacy & War", "Treaties"] },
  { feature: "budget-allocation", screen: null, planned: true, path: ["Treasury", "Allocation"] },
  { feature: "message-history", screen: "overview", path: ["Overview"] },
  { feature: "copy-game", screen: "options", path: ["Options"] },
  { feature: "resign", screen: null, planned: true, path: ["Options", "Resign"] },
  {
    feature: "ship-designer",
    screen: null,
    planned: true,
    path: ["Construction", "Design ship", "Edit"],
  },
];
