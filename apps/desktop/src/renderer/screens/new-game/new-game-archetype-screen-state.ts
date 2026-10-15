import {
  BALANCED_ALLOCATION,
  findPreset,
  validateArchetypeAllocation,
  type ArchetypeAllocation,
  type ArchetypeDimension,
  type ArchetypeSelection,
} from "@bluewave/campaign-engine";

export type ArchetypeMode = "preset" | "custom";

export interface ArchetypeEditorState {
  readonly mode: ArchetypeMode;
  readonly selectedPresetId: string | null;
  readonly allocation: ArchetypeAllocation;
}

export function initialArchetypeEditorState(): ArchetypeEditorState {
  return {
    mode: "preset",
    selectedPresetId: null,
    allocation: { ...BALANCED_ALLOCATION },
  };
}

export function restoreArchetypeEditorState(
  selection: ArchetypeSelection | null,
): ArchetypeEditorState {
  if (selection === null) return initialArchetypeEditorState();
  if (selection.kind === "preset") {
    return {
      mode: "preset",
      selectedPresetId: selection.id,
      allocation: { ...selection.allocation },
    };
  }
  return {
    mode: "custom",
    selectedPresetId: null,
    allocation: { ...selection.allocation },
  };
}

export function selectPreset(state: ArchetypeEditorState, presetId: string): ArchetypeEditorState {
  const preset = findPreset(presetId);
  if (preset === undefined) return state;
  return {
    mode: "preset",
    selectedPresetId: presetId,
    allocation: { ...preset.allocation },
  };
}

/** Copies the current selection into the custom editor, keeping the allocation editable. */
export function customizeSelection(state: ArchetypeEditorState): ArchetypeEditorState {
  return {
    mode: "custom",
    selectedPresetId: state.selectedPresetId,
    allocation: { ...state.allocation },
  };
}

export function createCustomArchetype(): ArchetypeEditorState {
  return {
    mode: "custom",
    selectedPresetId: null,
    allocation: { ...BALANCED_ALLOCATION },
  };
}

export function setDimension(
  state: ArchetypeEditorState,
  dimension: ArchetypeDimension,
  value: number,
): ArchetypeEditorState {
  if (state.mode !== "custom") return state;
  return {
    ...state,
    allocation: { ...state.allocation, [dimension]: value },
  };
}

/** Returns the custom editor to the neutral balanced baseline. */
export function resetCustomAllocation(state: ArchetypeEditorState): ArchetypeEditorState {
  if (state.mode !== "custom") return state;
  return { ...state, allocation: { ...BALANCED_ALLOCATION } };
}

export function usedPoints(state: ArchetypeEditorState): number {
  return state.allocation.economy + state.allocation.industry + state.allocation.combat;
}

export function isAllocationValid(state: ArchetypeEditorState): boolean {
  return validateArchetypeAllocation(state.allocation).ok;
}

export function allocationErrors(state: ArchetypeEditorState): readonly string[] {
  const result = validateArchetypeAllocation(state.allocation);
  return result.ok ? [] : result.diagnostics;
}

export function editorToSelection(state: ArchetypeEditorState): ArchetypeSelection {
  if (state.mode === "preset" && state.selectedPresetId !== null) {
    const preset = findPreset(state.selectedPresetId);
    if (preset !== undefined) {
      return {
        kind: "preset",
        id: preset.id,
        allocation: { ...preset.allocation },
      };
    }
  }
  return { kind: "custom", allocation: { ...state.allocation } };
}

export function selectedPreset(state: ArchetypeEditorState) {
  if (state.mode !== "preset" || state.selectedPresetId === null) return null;
  return findPreset(state.selectedPresetId) ?? null;
}
