import type { BatteryRole } from "@bluewave/ship-design";
import { SECTIONS, type InspectorPlace } from "../design-sections.js";

export const TAB_BATTERY: { readonly [tab: string]: BatteryRole } = {
  main: "MAIN",
  secondary: "SECONDARY",
  torpedoes: "TORPEDO",
};

export const tabLabel = (at: InspectorPlace): string =>
  SECTIONS[at.section].tabs.find((t) => t.id === at.tab)?.label ?? at.tab;

export const isTyping = (target: EventTarget): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest("input, textarea, select, [role='combobox'], [role='textbox']") !== null);
