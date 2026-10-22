import { useCallback, useMemo, useState } from "react";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";
import { Button } from "../../components/ui/button.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import type { AdmiralPresetValues } from "./admiral-preset.js";
import { EraScaleSection } from "./components/EraScaleSection.js";
import { ErrorState } from "./components/ErrorState.js";
import { HistoricalUncertaintySection } from "./components/HistoricalUncertaintySection.js";
import { LoadingState } from "./components/LoadingState.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
import { PresetDeckPane, PresetDetailPanel } from "./components/preset-deck/index.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";
import {
  applyPreset,
  PRESET_DEFINITIONS,
  type PresetId,
} from "./rules-of-the-naval-age-presets.js";
import { useNavalAgePreferences } from "./useNavalAgePreferences.js";

export interface RulesOfTheNavalAgeScreenProps {
  readonly recommendedPreset: AdmiralPresetValues | null;
  readonly onCancel: () => void;
  readonly onNext: (preferences: DraftPreferences, options: NewGameOptions) => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

export function RulesOfTheNavalAgeScreen({
  recommendedPreset,
  onCancel,
  onNext,
  onPrimaryActionChange,
}: RulesOfTheNavalAgeScreenProps) {
  const { state, options, preferences, ready, activePreset, setPreference, selectPreset } =
    useNavalAgePreferences(recommendedPreset);

  const [pendingPresetId, setPendingPresetId] = useState<PresetId | null>(null);

  const handlePreferenceChange = useCallback(
    (field: keyof DraftPreferences, value: string) => {
      setPendingPresetId(null);
      setPreference(field, value);
    },
    [setPreference],
  );

  const onScenarioChange = useCallback(
    (value: string) => setPreference("scenarioId", value),
    [setPreference],
  );

  const onFleetSizeChange = useCallback(
    (value: string) => {
      setPendingPresetId(null);
      setPreference("fleetSize", value);
    },
    [setPreference],
  );

  const onSeedChange = useCallback(
    (value: string) => setPreference("campaignSeed", value),
    [setPreference],
  );

  const [focusOverride, setFocusOverride] = useState<number | null>(null);
  const appliedIndex = PRESET_DEFINITIONS.findIndex((preset) => preset.id === activePreset);
  const focusedIndex = focusOverride ?? Math.max(0, appliedIndex);

  const focusedPreset = PRESET_DEFINITIONS[focusedIndex] ?? PRESET_DEFINITIONS[0];
  const appliedPresetName =
    PRESET_DEFINITIONS.find((preset) => preset.id === activePreset)?.name ?? "Custom";

  const onFocusIndex = useCallback((index: number) => {
    setFocusOverride(index);
    setPendingPresetId(PRESET_DEFINITIONS[index]?.id ?? null);
  }, []);

  const handleNext = useCallback(() => {
    if (options === null || !ready) return;
    if (pendingPresetId === null) {
      onNext(preferences, options);
      return;
    }
    selectPreset(pendingPresetId);
    onNext(applyPreset(preferences, pendingPresetId), options);
  }, [options, ready, preferences, pendingPresetId, selectPreset, onNext]);

  const primaryAction = useMemo(
    () => ({ label: "Next: Choose Archetype", disabled: !ready, onTrigger: handleNext }),
    [ready, handleNext],
  );
  usePrimaryAction(primaryAction, onPrimaryActionChange);

  return (
    <NewGameScreenLayout fullBleed>
      {options === null && (
        <div className="flex flex-col items-start gap-6 p-8">
          {state.loading && <LoadingState message="Loading campaign options…" />}
          {state.error !== null && (
            <ErrorState message={`Failed to load campaign options: ${state.error}`} />
          )}
          <Button type="button" variant="outline" onClick={onCancel}>
            Back
          </Button>
        </div>
      )}

      {options !== null && focusedPreset !== undefined && (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
          <PresetDeckPane
            activePreset={activePreset}
            focusedIndex={focusedIndex}
            onFocusIndex={onFocusIndex}
            onSelectPreset={selectPreset}
          />

          <section
            aria-label="Preset details"
            className="themed-scrollbar relative z-10 min-w-0 flex-1 lg:h-full lg:overflow-y-auto"
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-8">
              <p role="status" className="text-sm text-muted-foreground">
                Current setup:{" "}
                <span className="font-medium text-foreground">{appliedPresetName}</span>
              </p>

              <PresetDetailPanel
                key={focusedPreset.id}
                preset={focusedPreset}
                applied={focusedPreset.id === activePreset}
                pending={pendingPresetId === focusedPreset.id && focusedPreset.id !== activePreset}
              />

              <EraScaleSection
                scenarioId={preferences.scenarioId}
                campaignSeed={preferences.campaignSeed}
                fleetSize={preferences.fleetSize}
                scenarios={options.scenarios}
                fleetSizeOptions={options.supportedValues.fleetSize ?? []}
                onScenarioChange={onScenarioChange}
                onFleetSizeChange={onFleetSizeChange}
                onSeedChange={onSeedChange}
              />

              <HistoricalUncertaintySection
                preferences={preferences}
                supportedValues={options.supportedValues}
                onPreferenceChange={handlePreferenceChange}
              />

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Back
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </NewGameScreenLayout>
  );
}
