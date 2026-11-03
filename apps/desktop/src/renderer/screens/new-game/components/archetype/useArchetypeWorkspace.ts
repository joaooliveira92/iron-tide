import {
  ARCHETYPE_DIMENSION_MAX,
  ARCHETYPE_DIMENSION_MIN,
  ARCHETYPE_DIMENSIONS,
  ARCHETYPE_PRESETS,
  type ArchetypeAllocation,
  type ArchetypeDimension,
  type ArchetypePreset,
  type ArchetypeSelection,
} from "@bluewave/campaign-engine";
import { useCallback, useMemo, useState } from "react";
import type { PrimaryAction } from "../../../../shell/primary-action.js";
import {
  type ArchetypeEditorState,
  allocationErrors,
  createCustomArchetype,
  editorToSelection,
  isAllocationValid,
  resetCustomAllocation,
  restoreArchetypeEditorState,
  selectPreset,
  setDimension,
  usedPoints,
} from "../../new-game-archetype-screen-state.js";
import { CUSTOM_ARCHETYPE_ID } from "./ArchetypeCustomDeckCard.js";
import { ARCHETYPE_DECK_ENTRIES } from "./archetype-deck-entries.js";

export interface ArchetypeWorkspaceInput {
  readonly initialArchetype: ArchetypeSelection | null;
  readonly onNext: (selection: ArchetypeSelection) => void;
}

export interface ArchetypeWorkspaceState {
  readonly focusedIndex: number;
  readonly pendingSlotId: string | null;
  readonly applied: ArchetypeEditorState;
  readonly draft: ArchetypeEditorState;
  readonly allocatorFocusRequest: number;
}

export interface ArchetypeWorkspaceActions {
  readonly focusIndex: (index: number) => void;
  readonly activateIndex: (index: number) => void;
  readonly changeDimension: (dimension: ArchetypeDimension, value: number) => void;
  readonly resetDraft: () => void;
  readonly commit: () => void;
}

export interface ArchetypeDeckMeta {
  readonly focusedIndex: number;
  readonly appliedPresetId: string | null;
  readonly customApplied: boolean;
  readonly customAllocation: ArchetypeAllocation | null;
}

export type ArchetypeDetailEntry =
  | { readonly kind: "custom" }
  | { readonly kind: "preset"; readonly preset: ArchetypePreset };

export interface ArchetypeDetailMeta {
  readonly slotId: string | null;
  readonly entry: ArchetypeDetailEntry;
  readonly allocation: ArchetypeAllocation;
  readonly applied: boolean;
  readonly pending: boolean;
  readonly points: number;
  readonly errors: readonly string[];
}

export interface ArchetypeWorkspaceMeta {
  readonly deck: ArchetypeDeckMeta;
  readonly detail: ArchetypeDetailMeta;
  readonly appliedName: string;
  readonly primaryAction: PrimaryAction;
}

export interface ArchetypeWorkspace {
  readonly state: ArchetypeWorkspaceState;
  readonly actions: ArchetypeWorkspaceActions;
  readonly meta: ArchetypeWorkspaceMeta;
}

function appliedSlotId(state: ArchetypeEditorState): string | null {
  return state.mode === "custom" ? CUSTOM_ARCHETYPE_ID : state.selectedPresetId;
}

function slotIdAt(index: number): string | null {
  const entry = ARCHETYPE_DECK_ENTRIES[index];
  if (entry === undefined) return null;
  return entry.kind === "custom" ? CUSTOM_ARCHETYPE_ID : entry.id;
}

function sameAllocation(a: ArchetypeEditorState, b: ArchetypeEditorState): boolean {
  return ARCHETYPE_DIMENSIONS.every(
    (dimension) => a.allocation[dimension] === b.allocation[dimension],
  );
}

function clampDimensionValue(value: number): number {
  return Math.max(ARCHETYPE_DIMENSION_MIN, Math.min(ARCHETYPE_DIMENSION_MAX, value));
}

export function useArchetypeWorkspace({
  initialArchetype,
  onNext,
}: ArchetypeWorkspaceInput): ArchetypeWorkspace {
  const [applied, setApplied] = useState<ArchetypeEditorState>(() =>
    restoreArchetypeEditorState(initialArchetype),
  );
  const [draft, setDraft] = useState<ArchetypeEditorState>(() =>
    applied.mode === "custom" ? applied : createCustomArchetype(),
  );
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
  const [focusOverride, setFocusOverride] = useState<number | null>(null);
  const [allocatorFocusRequest, setAllocatorFocusRequest] = useState(0);

  const appliedId = appliedSlotId(applied);
  const appliedIndex = ARCHETYPE_DECK_ENTRIES.findIndex((entry) =>
    entry.kind === "custom" ? appliedId === CUSTOM_ARCHETYPE_ID : entry.id === appliedId,
  );
  const focusedIndex = focusOverride ?? Math.max(0, appliedIndex);
  const focusedEntry = ARCHETYPE_DECK_ENTRIES[focusedIndex] ?? ARCHETYPE_DECK_ENTRIES[0];
  const focusedPreset =
    focusedEntry?.kind === "preset"
      ? ARCHETYPE_PRESETS.find((preset) => preset.id === focusedEntry.id)
      : undefined;
  const focusedIsCustom = focusedEntry?.kind === "custom";
  const focusedSlotId = focusedIsCustom ? CUSTOM_ARCHETYPE_ID : (focusedPreset?.id ?? null);

  const customApplied = applied.mode === "custom";
  const customDirty = customApplied && !sameAllocation(draft, applied);
  const draftValid = isAllocationValid(draft);
  const hasSelection = appliedId !== null;
  const needsSelect =
    pendingSlotId !== null &&
    (pendingSlotId !== appliedId || (pendingSlotId === CUSTOM_ARCHETYPE_ID && customDirty));
  const customBlocked = needsSelect && pendingSlotId === CUSTOM_ARCHETYPE_ID && !draftValid;
  const detailApplied =
    focusedSlotId !== null && focusedSlotId === appliedId && !(focusedIsCustom && customDirty);
  const detailPending = focusedSlotId !== null && pendingSlotId === focusedSlotId && !detailApplied;
  const appliedName =
    applied.mode === "preset"
      ? (ARCHETYPE_PRESETS.find((preset) => preset.id === applied.selectedPresetId)?.name ??
        "Custom")
      : "Custom";

  const focusIndex = useCallback((index: number) => {
    setFocusOverride(index);
    setPendingSlotId(slotIdAt(index));
  }, []);

  const activateIndex = useCallback((index: number) => {
    const entry = ARCHETYPE_DECK_ENTRIES[index];
    if (entry === undefined) return;
    setFocusOverride(index);
    if (entry.kind === "custom") {
      setPendingSlotId(CUSTOM_ARCHETYPE_ID);
      setAllocatorFocusRequest((request) => request + 1);
      return;
    }
    setPendingSlotId(null);
    setApplied((current) => selectPreset(current, entry.id));
  }, []);

  const commit = useCallback(() => {
    if (needsSelect && pendingSlotId !== null) {
      if (pendingSlotId === CUSTOM_ARCHETYPE_ID) {
        if (!draftValid) return;
        setApplied({ ...createCustomArchetype(), allocation: { ...draft.allocation } });
      } else {
        setApplied((current) => selectPreset(current, pendingSlotId));
      }
      setPendingSlotId(null);
      return;
    }
    if (!hasSelection || !isAllocationValid(applied)) return;
    onNext(editorToSelection(applied));
  }, [needsSelect, pendingSlotId, draftValid, draft.allocation, hasSelection, applied, onNext]);

  const changeDimension = useCallback((dimension: ArchetypeDimension, value: number) => {
    setPendingSlotId(CUSTOM_ARCHETYPE_ID);
    setDraft((current) => setDimension(current, dimension, clampDimensionValue(value)));
  }, []);

  const resetDraft = useCallback(() => {
    setPendingSlotId(CUSTOM_ARCHETYPE_ID);
    setDraft((current) => resetCustomAllocation(current));
  }, []);

  const state = useMemo<ArchetypeWorkspaceState>(
    () => ({ focusedIndex, pendingSlotId, applied, draft, allocatorFocusRequest }),
    [focusedIndex, pendingSlotId, applied, draft, allocatorFocusRequest],
  );

  const actions = useMemo<ArchetypeWorkspaceActions>(
    () => ({ focusIndex, activateIndex, changeDimension, resetDraft, commit }),
    [focusIndex, activateIndex, changeDimension, resetDraft, commit],
  );

  const deck = useMemo<ArchetypeDeckMeta>(
    () => ({
      focusedIndex,
      appliedPresetId: applied.mode === "preset" ? applied.selectedPresetId : null,
      customApplied,
      customAllocation: customApplied ? applied.allocation : null,
    }),
    [focusedIndex, applied, customApplied],
  );

  const detail = useMemo<ArchetypeDetailMeta>(
    () => ({
      slotId: focusedSlotId,
      entry:
        focusedIsCustom || focusedPreset === undefined
          ? { kind: "custom" as const }
          : { kind: "preset" as const, preset: focusedPreset },
      allocation: focusedPreset?.allocation ?? draft.allocation,
      applied: detailApplied,
      pending: detailPending,
      points: usedPoints(draft),
      errors: allocationErrors(draft),
    }),
    [focusedSlotId, focusedPreset, focusedIsCustom, draft, detailApplied, detailPending],
  );

  const meta = useMemo<ArchetypeWorkspaceMeta>(
    () => ({
      deck,
      detail,
      appliedName,
      primaryAction: {
        label: needsSelect ? "Select" : "Choose Nation",
        disabled: (!hasSelection && !needsSelect) || customBlocked,
        onTrigger: commit,
      },
    }),
    [deck, detail, appliedName, needsSelect, hasSelection, customBlocked, commit],
  );

  return { state, actions, meta };
}
