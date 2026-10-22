import { useMemo } from "react";

import {
  createPresentationFormat,
  type PresentationFormat,
} from "../lib/presentation-format/index.js";
import { useCurrencyDisplayMode, usePreferences } from "../lib/preferences-context.js";
import { useActiveCampaignCurrencyContext } from "./CampaignShellContext.js";

/**
 * The presentation format bound to the player's preferences and the active
 * campaign's effective currency mode (ADR-0218). Components and pure view models
 * render through the returned `PresentationFormat`; nothing formats money or a
 * number by hand. Used outside a campaign (tests, previews) it resolves to the
 * defaults and Naval Credits, exactly as the shell would with no nation open.
 */
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
