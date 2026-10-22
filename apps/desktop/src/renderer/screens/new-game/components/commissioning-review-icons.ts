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

export function summaryRowIcon(id: SummaryRowIcon): LucideIcon {
  return ROW_ICONS[id];
}

export const FORECAST_ICONS = {
  heading: Telescope,
  doctrine: BookOpen,
  strategicRegions: Map,
  nationalCharacteristics: Flag,
  expectedPressures: TriangleAlert,
} as const;
