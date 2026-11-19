import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import { useBridge } from "../../lib/bridge-context.js";
import { readBridge } from "../../lib/bridge-read.js";
import { createValueStore, subscribeWithLifecycle } from "../../lib/value-store.js";
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

export function useNavalAgePreferences(
  recommendedPreset: AdmiralPresetValues | null,
  portOption?: NewGameOptionsPort,
): UseNavalAgePreferencesReturn {
  const contextBridge = useBridge();
  const port = portOption ?? contextBridge;
  const [store] = useState(() =>
    createValueStore<NewGamePreferencesScreenState>(initialNewGamePreferencesScreenState()),
  );
  const recommendedPresetRef = useRef(recommendedPreset);

  const subscribe = useMemo(
    () =>
      subscribeWithLifecycle(store, (target) => {
        async function loadOptions(): Promise<void> {
          const read = await readBridge(port, (p) =>
            p.campaign.execute("listNewGameOptions", undefined),
          );
          if (read.status !== "ready") {
            target.set((current) => applyOptionsFailed(current, read.reason));
            return;
          }
          target.set((current) =>
            applyOptionsLoaded(
              current,
              read.value,
              defaultCampaignSeed(),
              recommendedPresetRef.current,
            ),
          );
        }
        void loadOptions();
      }),
    [store, port],
  );
  const state = useSyncExternalStore(subscribe, store.get);

  const setPreference = useCallback(
    <K extends keyof DraftPreferences>(field: K, value: DraftPreferences[K]) => {
      store.set((current) => updatePreference(current, field, value));
    },
    [store],
  );

  const selectPreset = useCallback(
    (presetId: PresetId) => {
      store.set((current) => ({
        ...current,
        preferences: applyPreset(current.preferences, presetId),
      }));
    },
    [store],
  );

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
