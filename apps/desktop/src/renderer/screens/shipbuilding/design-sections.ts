import {
  Anchor,
  ClipboardCheck,
  Cog,
  Crosshair,
  LayoutDashboard,
  Radar,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { COMPONENT_CATEGORIES, type ComponentCategory } from "@bluewave/ship-design";

export const DESIGN_SECTIONS = [
  "overview",
  "hull",
  "machinery",
  "protection",
  "armament",
  "systems",
  "review",
] as const;
export type DesignSectionId = (typeof DESIGN_SECTIONS)[number];

export interface LocalTab {
  readonly id: string;
  readonly label: string;
}

export interface DesignSection {
  readonly id: DesignSectionId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tabs: readonly LocalTab[];
}

export const SECTIONS: { readonly [K in DesignSectionId]: DesignSection & { readonly id: K } } = {
  overview: {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    tabs: [
      { id: "summary", label: "Summary" },
      { id: "brief", label: "Brief" },
    ],
  },
  hull: {
    id: "hull",
    label: "Hull",
    icon: Anchor,
    tabs: [
      { id: "dimensions", label: "Dimensions" },
      { id: "stability", label: "Stability" },
    ],
  },
  machinery: {
    id: "machinery",
    label: "Machinery",
    icon: Cog,
    tabs: [
      { id: "propulsion", label: "Propulsion" },
      { id: "performance", label: "Performance" },
    ],
  },
  protection: {
    id: "protection",
    label: "Protection",
    icon: Shield,
    tabs: [
      { id: "armour", label: "Armour" },
      { id: "underwater", label: "Underwater" },
      { id: "magazines", label: "Magazines" },
    ],
  },
  armament: {
    id: "armament",
    label: "Armament",
    icon: Crosshair,
    tabs: [
      { id: "main", label: "Main battery" },
      { id: "secondary", label: "Secondary" },
      { id: "torpedoes", label: "Torpedoes" },
      { id: "other", label: "Other" },
    ],
  },
  systems: {
    id: "systems",
    label: "Systems",
    icon: Radar,
    tabs: [
      { id: "fire-control", label: "Fire control" },
      { id: "sensors", label: "Sensors" },
      { id: "aviation", label: "Aviation" },
      { id: "accommodation", label: "Accommodation" },
    ],
  },
  review: {
    id: "review",
    label: "Review",
    icon: ClipboardCheck,
    tabs: [
      { id: "findings", label: "Findings" },
      { id: "rebuild", label: "Rebuild" },
      { id: "finish", label: "Finish" },
    ],
  },
};

export const SECTION_ORDER: readonly DesignSection[] = DESIGN_SECTIONS.map((id) => SECTIONS[id]);

export interface InspectorPlace {
  readonly section: DesignSectionId;
  readonly tab: string;
}

export const CATEGORY_PLACE: { readonly [K in ComponentCategory]: InspectorPlace } = {
  HULL_FORM: { section: "hull", tab: "dimensions" },
  MATERIAL: { section: "hull", tab: "dimensions" },
  BOILER: { section: "machinery", tab: "propulsion" },
  ENGINE: { section: "machinery", tab: "propulsion" },
  SHAFT_PROPELLER: { section: "machinery", tab: "propulsion" },
  FUEL_BUNKER: { section: "machinery", tab: "propulsion" },
  GENERATOR: { section: "machinery", tab: "propulsion" },
  MAIN_GUN: { section: "armament", tab: "main" },
  SECONDARY_GUN: { section: "armament", tab: "secondary" },
  DUAL_PURPOSE_GUN: { section: "armament", tab: "secondary" },
  TERTIARY_GUN: { section: "armament", tab: "other" },
  TORPEDO_TUBE: { section: "armament", tab: "torpedoes" },
  AA_WEAPON: { section: "armament", tab: "other" },
  ASW_WEAPON: { section: "armament", tab: "other" },
  MINE_GEAR: { section: "armament", tab: "other" },
  MISSILE_LAUNCHER: { section: "armament", tab: "other" },
  MOUNT: { section: "armament", tab: "other" },
  ARMOUR_SCHEME: { section: "protection", tab: "armour" },
  UNDERWATER_PROTECTION: { section: "protection", tab: "underwater" },
  DAMAGE_CONTROL: { section: "protection", tab: "underwater" },
  MAGAZINE: { section: "protection", tab: "magazines" },
  AMMUNITION: { section: "protection", tab: "magazines" },
  DIRECTOR: { section: "systems", tab: "fire-control" },
  RANGEFINDER: { section: "systems", tab: "fire-control" },
  RADAR: { section: "systems", tab: "sensors" },
  SONAR: { section: "systems", tab: "sensors" },
  COMMS: { section: "systems", tab: "sensors" },
  AIRCRAFT_FACILITY: { section: "systems", tab: "aviation" },
  ACCOMMODATION: { section: "systems", tab: "accommodation" },
  SPECIAL_EQUIPMENT: { section: "systems", tab: "accommodation" },
};

export function categoriesOf(place: InspectorPlace): ReadonlySet<ComponentCategory> {
  return new Set(
    COMPONENT_CATEGORIES.filter(
      (c) => CATEGORY_PLACE[c].section === place.section && CATEGORY_PLACE[c].tab === place.tab,
    ),
  );
}

export function placeOf(section: DesignSectionId, tab?: string): InspectorPlace {
  const tabs = SECTIONS[section].tabs;
  return { section, tab: tabs.some((t) => t.id === tab) ? tab! : tabs[0]!.id };
}
