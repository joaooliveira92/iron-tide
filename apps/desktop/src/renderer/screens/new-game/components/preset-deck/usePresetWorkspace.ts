import { useCallback, useMemo, useState } from "react";
import type { NewGameOptions } from "../../../../../shared/new-game-contract.js";
import type { PrimaryAction } from "../../../../shell/primary-action.js";
import type { AdmiralPresetValues } from "../../admiral-preset.js";
import {
  applyPreset,
  PRESET_DEFINITIONS,
  type PresetDefinition,
  type PresetId,
} from "../../rules-of-the-naval-age-presets.js";
import type {
  DraftPreferences,
  NewGamePreferencesScreenState,
} from "../../new-game-preferences-screen-state.js";
import { useNavalAgePreferences } from "../../useNavalAgePreferences.js";

export interface PresetWorkspaceInput {
  readonly recommendedPreset: AdmiralPresetValues | null;
  readonly onNext: (preferences: DraftPreferences, options: NewGameOptions) => void;
}

export interface PresetWorkspaceState {
  readonly focusedIndex: number;
  readonly pendingPresetId: PresetId | null;
  readonly screen: NewGamePreferencesScreenState;
  readonly options: NewGameOptions | null;
  readonly preferences: DraftPreferences;
}

export interface PresetWorkspaceActions {
  readonly focusIndex: (index: number) => void;
  readonly activateIndex: (index: number) => void;
  readonly changePreference: (field: keyof DraftPreferences, value: string) => void;
  readonly changeScenario: (value: string) => void;
  readonly changeFleetSize: (value: string) => void;
  readonly changeSeed: (value: string) => void;
  readonly commit: () => void;
}

export interface PresetDeckMeta {
  readonly focusedIndex: number;
  readonly activePresetId: string;
}

export interface PresetDetailMeta {
  readonly preset: PresetDefinition | null;
  readonly applied: boolean;
  readonly pending: boolean;
}

export interface PresetWorkspaceMeta {
  readonly deck: PresetDeckMeta;
  readonly detail: PresetDetailMeta;
  readonly appliedName: string;
  readonly ready: boolean;
  readonly primaryAction: PrimaryAction;
}

export interface PresetWorkspace {
  readonly state: PresetWorkspaceState;
  readonly actions: PresetWorkspaceActions;
  readonly meta: PresetWorkspaceMeta;
}

function presetIdAt(index: number): PresetId | null {
  return PRESET_DEFINITIONS[index]?.id ?? null;
}

export function usePresetWorkspace({
  recommendedPreset,
  onNext,
}: PresetWorkspaceInput): PresetWorkspace {
  const { state, options, preferences, ready, activePreset, setPreference, selectPreset } =
    useNavalAgePreferences(recommendedPreset);
  const [pendingPresetId, setPendingPresetId] = useState<PresetId | null>(null);
  const [focusOverride, setFocusOverride] = useState<number | null>(null);

  const appliedIndex = PRESET_DEFINITIONS.findIndex((preset) => preset.id === activePreset);
  const focusedIndex = focusOverride ?? Math.max(0, appliedIndex);
  const focusedPreset = PRESET_DEFINITIONS[focusedIndex] ?? PRESET_DEFINITIONS[0];
  const focusedPresetId = focusedPreset?.id ?? null;
  const appliedPresetName =
    PRESET_DEFINITIONS.find((preset) => preset.id === activePreset)?.name ?? "Custom";

  const changePreference = useCallback(
    (field: keyof DraftPreferences, value: string) => {
      setPendingPresetId(null);
      setPreference(field, value);
    },
    [setPreference],
  );

  const changeScenario = useCallback(
    (value: string) => setPreference("scenarioId", value),
    [setPreference],
  );

  const changeFleetSize = useCallback(
    (value: string) => {
      setPendingPresetId(null);
      setPreference("fleetSize", value);
    },
    [setPreference],
  );

  const changeSeed = useCallback(
    (value: string) => setPreference("campaignSeed", value),
    [setPreference],
  );

  const focusIndex = useCallback((index: number) => {
    setFocusOverride(index);
    setPendingPresetId(presetIdAt(index));
  }, []);

  const activateIndex = useCallback(
    (index: number) => {
      const presetId = presetIdAt(index);
      if (presetId === null) return;
      setFocusOverride(index);
      setPendingPresetId(presetId);
      selectPreset(presetId);
    },
    [selectPreset],
  );

  const commit = useCallback(() => {
    if (options === null || !ready) return;
    if (pendingPresetId === null) {
      onNext(preferences, options);
      return;
    }
    selectPreset(pendingPresetId);
    onNext(applyPreset(preferences, pendingPresetId), options);
  }, [options, ready, preferences, pendingPresetId, selectPreset, onNext]);

  const stateValue = useMemo<PresetWorkspaceState>(
    () => ({ focusedIndex, pendingPresetId, screen: state, options, preferences }),
    [focusedIndex, pendingPresetId, state, options, preferences],
  );

  const actions = useMemo<PresetWorkspaceActions>(
    () => ({
      focusIndex,
      activateIndex,
      changePreference,
      changeScenario,
      changeFleetSize,
      changeSeed,
      commit,
    }),
    [
      focusIndex,
      activateIndex,
      changePreference,
      changeScenario,
      changeFleetSize,
      changeSeed,
      commit,
    ],
  );

  const deck = useMemo<PresetDeckMeta>(
    () => ({ focusedIndex, activePresetId: activePreset }),
    [focusedIndex, activePreset],
  );

  const detail = useMemo<PresetDetailMeta>(
    () => ({
      preset: focusedPreset ?? null,
      applied: focusedPresetId !== null && focusedPresetId === activePreset,
      pending:
        focusedPresetId !== null &&
        pendingPresetId === focusedPresetId &&
        focusedPresetId !== activePreset,
    }),
    [focusedPreset, focusedPresetId, pendingPresetId, activePreset],
  );

  const meta = useMemo<PresetWorkspaceMeta>(
    () => ({
      deck,
      detail,
      appliedName: appliedPresetName,
      ready,
      primaryAction: { label: "Next: Choose Archetype", disabled: !ready, onTrigger: commit },
    }),
    [deck, detail, appliedPresetName, ready, commit],
  );

  return { state: stateValue, actions, meta };
}
