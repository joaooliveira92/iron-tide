import { translate, type MessageKey } from "../lib/strings.js";
import type { CampaignScreen } from "./campaign-screen-registry.js";

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

export const SIDEBAR_SECTION_LABEL_KEYS: Readonly<Record<SidebarSectionId, MessageKey>> = {
  admiralty: "nav.section.admiralty",
  operations: "nav.section.operations",
  government: "nav.section.government",
  foreign: "nav.section.foreign",
  developer: "nav.section.developer",
  settings: "nav.section.settings",
};

export const SECTION_OF_SCREEN: Readonly<Record<CampaignScreen, SidebarSectionId>> = {
  overview: "admiralty",
  fleet: "operations",
  construction: "operations",
  "ship-design": "operations",
  research: "government",
  treasury: "government",
  diplomacy: "foreign",
  simulation: "developer",
  "tactical-sandbox": "developer",
  debugging: "developer",
  "strategic-map": "operations",
  "campaign-preferences": "settings",
  options: "settings",
};

export interface SidebarSection<Item extends { readonly id: CampaignScreen }> {
  readonly id: SidebarSectionId;
  readonly label: string;
  readonly items: readonly Item[];
}

export function buildSidebarSections<Item extends { readonly id: CampaignScreen }>(
  screens: readonly Item[],
): SidebarSection<Item>[] {
  return SIDEBAR_SECTION_ORDER.map((id) => ({
    id,
    label: translate(SIDEBAR_SECTION_LABEL_KEYS[id]),
    items: screens.filter((screen) => SECTION_OF_SCREEN[screen.id] === id),
  })).filter((section) => section.items.length > 0);
}
