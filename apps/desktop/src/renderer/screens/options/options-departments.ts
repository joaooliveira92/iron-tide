import {
  Accessibility,
  Coins,
  Languages,
  Palette,
  Ruler,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
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

export const OPTIONS_DEPARTMENT_ORDER: readonly OptionsDepartment[] = [
  "general",
  "appearance",
  "measurements",
  "currency",
  "language",
  "accessibility",
];

export function optionsDepartmentMeta(id: OptionsDepartment): OptionsDepartmentMeta {
  return DEPARTMENTS[id];
}
