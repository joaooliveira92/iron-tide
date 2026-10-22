import { CAMPAIGN_SCREEN_REGISTRY, type Screen } from "./campaign-screen-registry.js";
import { buildSidebarSections } from "./sidebar-sections.js";

export const CAMPAIGN_NAVIGATION_SECTIONS = buildSidebarSections(CAMPAIGN_SCREEN_REGISTRY);

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
