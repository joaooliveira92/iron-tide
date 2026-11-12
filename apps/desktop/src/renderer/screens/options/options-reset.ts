import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences,
} from "../../../shared/preferences-contract.js";
import type { OptionsDepartment } from "./options-departments.js";

const DEFAULTS = DEFAULT_APP_PREFERENCES;

export function departmentResetPatch(id: OptionsDepartment): Partial<AppPreferences> {
  switch (id) {
    case "general":
      return DEFAULTS;
    case "appearance":
      return {
        theme: DEFAULTS.theme,
        background: DEFAULTS.background,
        font: DEFAULTS.font,
        interfaceDensity: DEFAULTS.interfaceDensity,
        textScale: DEFAULTS.textScale,
      };
    case "measurements":
      return {
        measurementPreset: DEFAULTS.measurementPreset,
        measurementSelections: DEFAULTS.measurementSelections,
      };
    case "currency":
      return {
        currencyDisplayMode: DEFAULTS.currencyDisplayMode,
        numberScale: DEFAULTS.numberScale,
      };
    case "language":
      return {
        language: DEFAULTS.language,
        formattingLocale: DEFAULTS.formattingLocale,
      };
    case "accessibility":
      return {
        reducedMotion: DEFAULTS.reducedMotion,
        tooltipDetail: DEFAULTS.tooltipDetail,
      };
  }
}
