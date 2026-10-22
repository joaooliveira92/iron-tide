import { useMemo } from "react";

import {
  createPresentationFormat,
  type PresentationFormat,
} from "../lib/presentation-format/index.js";
import { useCurrencyDisplayMode, usePreferences } from "../lib/preferences-context.js";
import { useActiveCampaignCurrencyContext } from "./CampaignShellContext.js";

export function usePresentationFormat(): PresentationFormat {
  const { preferences } = usePreferences();
  const context = useActiveCampaignCurrencyContext();
  const currency = useCurrencyDisplayMode(context);
  const { formattingLocale, numberScale, measurementPreset, measurementSelections } = preferences;
  return useMemo(
    () =>
      createPresentationFormat({
        locale: formattingLocale,
        numberScale,
        measurementPreset,
        measurementSelections,
        currency: {
          mode: currency.effective,
          ...(currency.fallbackReason !== undefined
            ? { fallbackReason: currency.fallbackReason }
            : {}),
        },
      }),
    [
      formattingLocale,
      numberScale,
      measurementPreset,
      measurementSelections,
      currency.effective,
      currency.fallbackReason,
    ],
  );
}
