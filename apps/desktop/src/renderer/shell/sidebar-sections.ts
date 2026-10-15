import type { CampaignScreen } from "./campaign-screen-registry.js";

/**
 * How the sidebar groups the campaign screens (spec N-2): by the job the player is doing, not by
 * the order screens were built. The map is exhaustive on `CampaignScreen`, so adding a screen
 * without deciding where it lives is a compile error — the sidebar can never silently drop one.
 */
export type SidebarSectionId =
  | "admiralty"
  | "operations"
  | "government"
  | "foreign"
  | "developer"
  | "settings";

export const SIDEBAR_SECTION_ORDER: readonly SidebarSectionId[] = [
  "admiralty",
  "operations",
  "government",
  "foreign",
  "developer",
  "settings",
];

export const SIDEBAR_SECTION_LABELS: Readonly<Record<SidebarSectionId, string>> = {
  admiralty: "Admiralty",
  operations: "Operations",
  government: "Government",
  foreign: "Foreign",
  developer: "Developer",
  settings: "Settings",
};

export const SECTION_OF_SCREEN: Readonly<Record<CampaignScreen, SidebarSectionId>> = {
  overview: "admiralty",
  fleet: "operations",
  construction: "operations",
  research: "government",
  treasury: "government",
  diplomacy: "foreign",
  simulation: "developer",
  "tactical-sandbox": "developer",
  debugging: "developer",
  "map-prototype": "developer",
  "campaign-preferences": "settings",
  options: "settings",
};

export interface SidebarSection<Item extends { readonly id: CampaignScreen }> {
  readonly id: SidebarSectionId;
  readonly label: string;
  readonly items: readonly Item[];
}

/**
 * The registered screens grouped into non-empty sections, in the fixed section order. Within a
 * section, screens keep their registry order. Sections with no registered screen (for example
 * "Developer" in a release build) are omitted.
 */
export function buildSidebarSections<Item extends { readonly id: CampaignScreen }>(
  screens: readonly Item[],
): SidebarSection<Item>[] {
  return SIDEBAR_SECTION_ORDER.map((id) => ({
    id,
    label: SIDEBAR_SECTION_LABELS[id],
    items: screens.filter((screen) => SECTION_OF_SCREEN[screen.id] === id),
  })).filter((section) => section.items.length > 0);
}
