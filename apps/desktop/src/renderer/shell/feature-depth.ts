/**
 * Click-depth ledger (spec rtw3-parity-ux-overhaul, N-1/N-5). Every player
 * feature lists the clicks needed to reach it from the home dashboard. The
 * sidebar entry is click 1; a tab/section inside a screen is click 2; an item
 * or drawer inside that is click 3. No feature may exceed MAX_CLICK_DEPTH.
 *
 * `screen` ties an entry to a registry screen so a new screen cannot ship
 * without a ledger row (see feature-depth.test.ts). `planned` rows are
 * features from the RTW3 parity spec whose screen does not exist yet: they
 * record the intended path so the 3-click budget is designed in, not
 * discovered later.
 */
import type { CampaignScreen } from "./campaign-screen-registry.js";

export const MAX_CLICK_DEPTH = 3;

export interface FeatureDepthEntry {
  readonly feature: string;
  readonly screen: CampaignScreen | null;
  /** Clicks from home, e.g. ["Fleet", "Organization", "Edit division"]. */
  readonly path: readonly string[];
  readonly planned?: true;
}

export const FEATURE_DEPTH: readonly FeatureDepthEntry[] = [
  { feature: "overview", screen: "overview", path: ["Overview"] },
  // The map is the Overview's primary panel (0 extra clicks); F1 opens it full-screen.
  { feature: "world-map", screen: "overview", path: ["Overview"] },
  {
    feature: "ships-under-construction",
    screen: "construction",
    path: ["Construction", "Shipyard Ledger"],
  },
  { feature: "design-catalog", screen: "construction", path: ["Construction", "Design Catalog"] },
  { feature: "construction-commands", screen: "construction", path: ["Construction", "Commands"] },
  { feature: "fleet-movement", screen: "fleet", path: ["Fleet"] },
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
  // Planned — RTW3 parity (F-*). Paths are the budgeted placement.
  // War scores + the explicit "not modelled" list live on the Diplomacy screen.
  { feature: "war-panel", screen: "diplomacy", path: ["Diplomacy & War"] },
  // Shown as an explicit "not modelled" panel (docs/research/rtw3-intel-and-submarines-engine-surface.md).
  { feature: "intel", screen: "diplomacy", path: ["Diplomacy & War"] },
  // Shown as an explicit "not modelled" panel (docs/research/rtw3-intel-and-submarines-engine-surface.md).
  { feature: "submarines", screen: "fleet", path: ["Fleet"] },
  // Deferred panel inside Construction's "Not yet modelled" section (IMP-06, CC-8).
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
  // Fleet "Losses" section: the player's sunk ships by name, class and cause (ADR-0061).
  { feature: "fleet-losses", screen: "fleet", path: ["Fleet", "Losses"] },
  // Battle history with loss counts (names/dates not recorded by the engine: docs/research/rtw3-losses-ledger-engine-surface.md).
  { feature: "ships-sunk-or-scrapped", screen: "diplomacy", path: ["Diplomacy & War"] },
  // Per-area table inside Fleet.
  { feature: "area-overview", screen: "fleet", path: ["Fleet", "Area overview"] },
  // Real: the 5 engine division commands, in Fleet (docs/research/rtw3-parity-engine-roadmap.md).
  { feature: "fleet-organization", screen: "fleet", path: ["Fleet"] },
  // Deferred items inside Fleet's "Not yet modelled" section (IMP-06, CC-8).
  { feature: "air-groups", screen: "fleet", path: ["Fleet", "Not yet modelled"] },
  { feature: "aircraft-types", screen: "fleet", path: ["Fleet", "Not yet modelled"] },
  // Real: division commanders (ADR-0065) in Fleet's Officers section.
  { feature: "officers", screen: "fleet", path: ["Fleet", "Officers"] },
  { feature: "doctrine", screen: null, planned: true, path: ["Research & Technology", "Doctrine"] },
  { feature: "mobilization", screen: null, planned: true, path: ["Treasury", "Mobilization"] },
  { feature: "fleet-exercise", screen: "fleet", path: ["Fleet", "Not yet modelled"] },
  { feature: "treaty-limits", screen: null, planned: true, path: ["Diplomacy & War", "Treaties"] },
  { feature: "budget-allocation", screen: null, planned: true, path: ["Treasury", "Allocation"] },
  // Real, session-only: the monthly report + earlier months on Overview (the engine keeps no month history yet).
  { feature: "message-history", screen: "overview", path: ["Overview"] },
  // Real: "Save a Copy…" in Options (copyCampaign).
  { feature: "copy-game", screen: "options", path: ["Options"] },
  { feature: "resign", screen: null, planned: true, path: ["Options", "Resign"] },
  {
    feature: "ship-designer",
    screen: null,
    planned: true,
    path: ["Construction", "Design ship", "Edit"],
  },
];
