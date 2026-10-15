import {
  ARCHETYPE_DIMENSION_MAX,
  ARCHETYPE_DIMENSION_MIN,
  ARCHETYPE_DIMENSIONS,
  ARCHETYPE_PRESETS,
  type ArchetypeDimension,
  type ArchetypeSelection,
} from "@bluewave/campaign-engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import {
  ARCHETYPE_DECK_ENTRIES,
  ArchetypeDeckPane,
  ArchetypeDetailPanel,
  CUSTOM_ARCHETYPE_ID,
} from "./components/archetype/index.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
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
} from "./new-game-archetype-screen-state.js";

export interface NewGameArchetypeScreenProps {
  readonly initialArchetype: ArchetypeSelection | null;
  readonly onBack: () => void;
  readonly onNext: (selection: ArchetypeSelection) => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

/** The deck slot id an editor state has applied: a preset id, `custom`, or nothing yet. */
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

export function NewGameArchetypeScreen({
  initialArchetype,
  onBack,
  onNext,
  onPrimaryActionChange,
}: NewGameArchetypeScreenProps) {
  // The applied selection: the only state that becomes `onNext`'s payload.
  const [state, setState] = useState<ArchetypeEditorState>(() =>
    restoreArchetypeEditorState(initialArchetype),
  );
  // The custom slot's working allocation, edited inline. It becomes the
  // selection only when the player applies it.
  const [draft, setDraft] = useState<ArchetypeEditorState>(() =>
    state.mode === "custom" ? state : createCustomArchetype(),
  );

  // The slot the player has previewed but not applied. The primary action
  // applies it. Presentation state only: never the selection, never persisted.
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);

  // Which deck card is previewed: until the player moves focus it is the
  // applied slot (or the first card while nothing is applied).
  const [focusOverride, setFocusOverride] = useState<number | null>(null);
  const appliedId = appliedSlotId(state);
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

  const customApplied = state.mode === "custom";
  // An applied custom build whose working allocation has since been edited.
  const customDirty = customApplied && !sameAllocation(draft, state);
  const draftValid = isAllocationValid(draft);

  const hasSelection = appliedId !== null;
  const needsSelect =
    pendingSlotId !== null &&
    (pendingSlotId !== appliedId || (pendingSlotId === CUSTOM_ARCHETYPE_ID && customDirty));
  const customBlocked = needsSelect && pendingSlotId === CUSTOM_ARCHETYPE_ID && !draftValid;

  const appliedName =
    state.mode === "preset"
      ? (ARCHETYPE_PRESETS.find((preset) => preset.id === state.selectedPresetId)?.name ?? "Custom")
      : "Custom";

  // Enter or a tap on the custom card reveals the allocator and moves focus
  // into it. The request is a counter so repeating it refocuses.
  const detailRef = useRef<HTMLElement | null>(null);
  const [allocatorFocusRequest, setAllocatorFocusRequest] = useState(0);
  useEffect(() => {
    if (allocatorFocusRequest === 0) return;
    detailRef.current?.querySelector<HTMLInputElement>('input[type="range"]')?.focus();
  }, [allocatorFocusRequest]);

  const onFocusIndex = useCallback((index: number) => {
    setFocusOverride(index);
    setPendingSlotId(slotIdAt(index));
  }, []);

  const onActivateIndex = useCallback((index: number) => {
    const entry = ARCHETYPE_DECK_ENTRIES[index];
    if (entry === undefined) return;
    setFocusOverride(index);
    if (entry.kind === "custom") {
      setPendingSlotId(CUSTOM_ARCHETYPE_ID);
      setAllocatorFocusRequest((request) => request + 1);
      return;
    }
    setPendingSlotId(null);
    setState((current) => selectPreset(current, entry.id));
  }, []);

  const handleNext = useCallback(() => {
    if (needsSelect && pendingSlotId !== null) {
      if (pendingSlotId === CUSTOM_ARCHETYPE_ID) {
        if (!draftValid) return;
        setState({ ...createCustomArchetype(), allocation: { ...draft.allocation } });
      } else {
        setState((current) => selectPreset(current, pendingSlotId));
      }
      setPendingSlotId(null);
      return;
    }
    if (!hasSelection || !isAllocationValid(state)) return;
    onNext(editorToSelection(state));
  }, [needsSelect, pendingSlotId, draftValid, draft.allocation, hasSelection, state, onNext]);

  const primaryAction = useMemo(
    () => ({
      label: needsSelect ? "Select" : "Choose Nation",
      disabled: (!hasSelection && !needsSelect) || customBlocked,
      onTrigger: handleNext,
    }),
    [needsSelect, hasSelection, customBlocked, handleNext],
  );
  usePrimaryAction(primaryAction, onPrimaryActionChange);

  const handleReset = useCallback(() => {
    setPendingSlotId(CUSTOM_ARCHETYPE_ID);
    setDraft((current) => resetCustomAllocation(current));
  }, []);

  const handleDimensionChange = useCallback((dimension: ArchetypeDimension, value: number) => {
    setPendingSlotId(CUSTOM_ARCHETYPE_ID);
    setDraft((current) => setDimension(current, dimension, clampDimensionValue(value)));
  }, []);

  const editor = useMemo(
    () => ({
      points: usedPoints(draft),
      errors: allocationErrors(draft),
      onDimensionChange: handleDimensionChange,
      onReset: handleReset,
    }),
    [draft, handleDimensionChange, handleReset],
  );

  const panelAllocation = focusedPreset?.allocation ?? draft.allocation;
  const panelApplied =
    focusedSlotId !== null && focusedSlotId === appliedId && !(focusedIsCustom && customDirty);
  const panelPending = focusedSlotId !== null && pendingSlotId === focusedSlotId && !panelApplied;

  return (
    <NewGameScreenLayout fullBleed>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <ArchetypeDeckPane
          focusedIndex={focusedIndex}
          onFocusIndex={onFocusIndex}
          onActivateIndex={onActivateIndex}
          appliedPresetId={state.mode === "preset" ? state.selectedPresetId : null}
          customApplied={customApplied}
          customAllocation={customApplied ? state.allocation : null}
        />

        <section
          ref={detailRef}
          aria-label="Archetype details"
          className="themed-scrollbar relative z-10 min-w-0 flex-1 lg:h-full lg:overflow-y-auto"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 lg:p-8">
            <p role="status" className="text-sm text-muted-foreground">
              Current archetype: <span className="font-medium text-foreground">{appliedName}</span>
            </p>

            <ArchetypeDetailPanel
              key={focusedSlotId ?? "none"}
              entry={focusedPreset === undefined ? {} : { preset: focusedPreset }}
              allocation={panelAllocation}
              applied={panelApplied}
              pending={panelPending}
              editor={focusedIsCustom ? editor : undefined}
            />

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={onBack}>
                Back to Preferences
              </Button>
            </div>
          </div>
        </section>
      </div>
    </NewGameScreenLayout>
  );
}
