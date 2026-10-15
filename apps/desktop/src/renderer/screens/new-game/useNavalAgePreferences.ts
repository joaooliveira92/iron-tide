import { useCallback, useEffect, useRef, useState } from "react";

import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import { useBridge } from "../../lib/bridge-context.js";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";
import type { AdmiralPresetValues } from "./admiral-preset.js";
import {
  applyOptionsFailed,
  applyOptionsLoaded,
  initialNewGamePreferencesScreenState,
  isReadyToProceed,
  selectedScenario,
  updatePreference,
  type DraftPreferences,
  type NewGamePreferencesScreenState,
} from "./new-game-preferences-screen-state.js";
import {
  applyPreset,
  detectActivePreset,
  type PresetId,
} from "./rules-of-the-naval-age-presets.js";
import { defaultCampaignSeed } from "./utils/campaign-seed.js";

/** The narrow transport the step needs; injectable so the screen can be tested headlessly. */
export type NewGameOptionsPort = Pick<BluewaveDesktopBridge, "campaign">;

export interface UseNavalAgePreferencesReturn {
  readonly state: NewGamePreferencesScreenState;
  readonly options: NewGameOptions | null;
  readonly preferences: DraftPreferences;
  readonly scenario: ReturnType<typeof selectedScenario>;
  readonly ready: boolean;
  readonly activePreset: ReturnType<typeof detectActivePreset>;
  readonly setPreference: <K extends keyof DraftPreferences>(
    field: K,
    value: DraftPreferences[K],
  ) => void;
  readonly selectPreset: (presetId: PresetId) => void;
}

/**
 * Loads the campaign options and owns the Rules-of-the-Naval-Age draft. The
 * recommended preset is captured once on mount (a later prop change must not
 * clobber the player's edits) and only seeds the initial draft.
 */
export function useNavalAgePreferences(
  recommendedPreset: AdmiralPresetValues | null,
  portOption?: NewGameOptionsPort,
): UseNavalAgePreferencesReturn {
  const contextBridge = useBridge();
  const port = portOption ?? contextBridge;
  const [state, setState] = useState<NewGamePreferencesScreenState>(
    initialNewGamePreferencesScreenState,
  );
  const recommendedPresetRef = useRef(recommendedPreset);

  useEffect(() => {
    async function loadOptions(): Promise<void> {
      if (port === undefined) {
        setState((current) => applyOptionsFailed(current, "Bluewave bridge not available"));
        return;
      }
      const result = await port.campaign.execute("listNewGameOptions", undefined);
      if (result.outcome !== "success") {
        setState((current) => applyOptionsFailed(current, result.reason));
        return;
      }
      setState((current) =>
        applyOptionsLoaded(
          current,
          result.value,
          defaultCampaignSeed(),
          recommendedPresetRef.current,
        ),
      );
    }
    void loadOptions();
  }, [port]);

  const setPreference = useCallback(
    <K extends keyof DraftPreferences>(field: K, value: DraftPreferences[K]) => {
      setState((current) => updatePreference(current, field, value));
    },
    [],
  );

  const selectPreset = useCallback((presetId: PresetId) => {
    setState((current) => ({
      ...current,
      preferences: applyPreset(current.preferences, presetId),
    }));
  }, []);

  return {
    state,
    options: state.options,
    preferences: state.preferences,
    scenario: selectedScenario(state),
    ready: isReadyToProceed(state),
    activePreset: detectActivePreset(state.preferences),
    setPreference,
    selectPreset,
  };
}
