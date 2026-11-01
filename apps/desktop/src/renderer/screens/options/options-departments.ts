import {
  Accessibility,
  Coins,
  Languages,
  Palette,
  Ruler,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { IndexTab } from "../../components/slate/IndexTabs.js";
import { translate } from "../../lib/strings.js";

export type OptionsDepartment =
  | "general"
  | "appearance"
  | "measurements"
  | "currency"
  | "language"
  | "accessibility";

export interface OptionsDepartmentMeta {
  readonly id: OptionsDepartment;
  readonly label: string;
  readonly summary: string;
  readonly icon: LucideIcon;
}

const DEPARTMENTS: Readonly<Record<OptionsDepartment, OptionsDepartmentMeta>> = {
  general: {
    id: "general",
    label: translate("settings.section.general"),
    summary: translate("settings.summary.general"),
    icon: SlidersHorizontal,
  },
  appearance: {
    id: "appearance",
    label: translate("settings.section.appearance"),
    summary: translate("settings.summary.appearance"),
    icon: Palette,
  },
  measurements: {
    id: "measurements",
    label: translate("settings.section.measurements"),
    summary: translate("settings.summary.measurements"),
    icon: Ruler,
  },
  currency: {
    id: "currency",
    label: translate("settings.section.currency"),
    summary: translate("settings.summary.currency"),
    icon: Coins,
  },
  language: {
    id: "language",
    label: translate("settings.section.language"),
    summary: translate("settings.summary.language"),
    icon: Languages,
  },
  accessibility: {
    id: "accessibility",
    label: translate("settings.section.accessibility"),
    summary: translate("settings.summary.accessibility"),
    icon: Accessibility,
  },
};

const GROUP_IDS: readonly (readonly OptionsDepartment[])[] = [
  ["general", "appearance"],
  ["measurements", "currency"],
  ["language", "accessibility"],
];

export function optionsDepartmentMeta(id: OptionsDepartment): OptionsDepartmentMeta {
  return DEPARTMENTS[id];
}

export interface OptionsDepartmentFacts {
  readonly theme: string;
  readonly measurementPreset: string;
  readonly currency: string;
  readonly currencyAttention: boolean;
  readonly language: string;
  readonly motion: string;
}

function detail(
  id: OptionsDepartment,
  facts: OptionsDepartmentFacts,
): { readonly text: string; readonly attention: boolean } {
  switch (id) {
    case "general":
      return { text: translate("settings.general.detail"), attention: false };
    case "appearance":
      return { text: facts.theme, attention: false };
    case "measurements":
      return { text: facts.measurementPreset, attention: false };
    case "currency":
      return { text: facts.currency, attention: facts.currencyAttention };
    case "language":
      return { text: facts.language, attention: false };
    case "accessibility":
      return { text: facts.motion, attention: false };
  }
}

export function optionsIndexTabs(
  facts: OptionsDepartmentFacts,
): readonly (readonly IndexTab<OptionsDepartment>[])[] {
  return GROUP_IDS.map((group) =>
    group.map((id) => {
      const meta = DEPARTMENTS[id];
      const { text, attention } = detail(id, facts);
      return { id, label: meta.label, icon: meta.icon, detail: text, attention };
    }),
  );
}
