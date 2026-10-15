import { CAMPAIGN_SCREEN_REGISTRY, type Screen } from "./campaign-screen-registry.js";
import { buildSidebarSections } from "./sidebar-sections.js";

/**
 * The single source of truth for in-campaign navigation: every navigation surface (the sidebar,
 * the bottom bar) renders these sections, so labels, icons, order and DEBUG_MODE gating cannot drift.
 */
export const CAMPAIGN_NAVIGATION_SECTIONS = buildSidebarSections(CAMPAIGN_SCREEN_REGISTRY);

/** Pre-campaign flow screens (file picker, new-game wizard, briefing) have no campaign navigation. */
const PRE_CAMPAIGN_SCREENS: ReadonlySet<Screen> = new Set<Screen>([
  "file",
  "new-game-nation",
  "new-game-preferences",
  "new-game-archetype",
  "new-game-identity",
  "new-game-fleet-method",
  "new-game-review",
  "opening-briefing",
]);

export function showsCampaignNavigation(screen: Screen): boolean {
  return !PRE_CAMPAIGN_SCREENS.has(screen);
}
