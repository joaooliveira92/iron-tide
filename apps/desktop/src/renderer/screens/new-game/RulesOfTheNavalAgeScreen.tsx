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
import {
  PresetDeckPane,
  PresetDetailPanel,
  PresetWorkspaceProvider,
  usePresetWorkspace,
} from "./components/preset-deck/index.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";

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
  const workspace = usePresetWorkspace({ recommendedPreset, onNext });
  const { state, actions, meta } = workspace;
  const { appliedName, detail, primaryAction } = meta;

  usePrimaryAction(primaryAction, onPrimaryActionChange);

  return (
    <NewGameScreenLayout variant="bleed">
      {state.options === null && (
        <div className="flex flex-col items-start gap-6 p-8">
          {state.screen.loading && <LoadingState message="Loading campaign options…" />}
          {state.screen.error !== null && (
            <ErrorState message={`Failed to load campaign options: ${state.screen.error}`} />
          )}
          <Button type="button" variant="outline" onClick={onCancel}>
            Back
          </Button>
        </div>
      )}

      {state.options !== null && detail.preset !== null && (
        <PresetWorkspaceProvider workspace={workspace}>
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
            <PresetDeckPane />

            <section
              aria-label="Preset details"
              className="themed-scrollbar relative z-10 min-w-0 flex-1 lg:h-full lg:overflow-y-auto"
            >
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-8">
                <p role="status" className="text-sm text-muted-foreground">
                  Current setup: <span className="font-medium text-foreground">{appliedName}</span>
                </p>

                <PresetDetailPanel key={detail.preset.id} />

                <EraScaleSection
                  scenarioId={state.preferences.scenarioId}
                  campaignSeed={state.preferences.campaignSeed}
                  fleetSize={state.preferences.fleetSize}
                  scenarios={state.options.scenarios}
                  fleetSizeOptions={state.options.supportedValues.fleetSize ?? []}
                  onScenarioChange={actions.changeScenario}
                  onFleetSizeChange={actions.changeFleetSize}
                  onSeedChange={actions.changeSeed}
                />

                <HistoricalUncertaintySection
                  preferences={state.preferences}
                  supportedValues={state.options.supportedValues}
                  onPreferenceChange={actions.changePreference}
                />

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={onCancel}>
                    Back
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </PresetWorkspaceProvider>
      )}
    </NewGameScreenLayout>
  );
}
