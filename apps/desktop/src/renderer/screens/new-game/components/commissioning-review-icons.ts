import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Compass,
  Feather,
  Flag,
  Hourglass,
  Map,
  Medal,
  RotateCcw,
  Ruler,
  ScrollText,
  Ship,
  ShipWheel,
  SignalMedium,
  SlidersHorizontal,
  Telescope,
  TriangleAlert,
} from "lucide-react";
import type {
  SummaryGroup,
  SummaryRowIcon,
} from "../new-game-commissioning-review-screen-state.js";
import { uncertaintyFieldIcon } from "./option-icons.js";

/**
 * The lucide vocabulary for the Final commissioning review screen — one glyph
 * per summary section, one per summary row, and the forecast panel's marks.
 * The uncertainty rows reuse `option-icons` so the review echoes the exact
 * glyphs their select options showed earlier in the wizard.
 */

/** The section heading glyph shown in each summary card's badge. */
export const COMMISSIONING_GROUP_ICONS: Record<SummaryGroup, LucideIcon> = {
  command: ShipWheel,
  uncertainty: SlidersHorizontal,
  identity: ScrollText,
};

const ROW_ICONS: Record<SummaryRowIcon, LucideIcon> = {
  nation: Flag,
  era: Hourglass,
  fleetSize: SignalMedium,
  researchSpeed: uncertaintyFieldIcon("researchSpeed"),
  technologyVariation: uncertaintyFieldIcon("technologyVariation"),
  historicalBudget: uncertaintyFieldIcon("historicalBudget"),
  tacticalRealism: uncertaintyFieldIcon("tacticalRealism"),
  difficulty: uncertaintyFieldIcon("difficulty"),
  fleetMethod: Ship,
  archetype: Compass,
  namingConvention: ScrollText,
  shipNameReuse: RotateCcw,
  measurementSystem: Ruler,
  admiral: Medal,
  campaignName: Feather,
};

/** The glyph for a summary row's label. */
export function summaryRowIcon(id: SummaryRowIcon): LucideIcon {
  return ROW_ICONS[id];
}

/** The glyphs for the strategic forecast panel's marks. */
export const FORECAST_ICONS = {
  heading: Telescope,
  doctrine: BookOpen,
  strategicRegions: Map,
  nationalCharacteristics: Flag,
  expectedPressures: TriangleAlert,
} as const;
