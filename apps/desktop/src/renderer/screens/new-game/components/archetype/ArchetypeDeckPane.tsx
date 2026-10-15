import { ARCHETYPE_POINT_TOTAL, ARCHETYPE_PRESETS } from "@bluewave/campaign-engine";
import { paletteForIndex } from "@/components/card-deck/index.js";
import { DeckMasterPane } from "@/components/card-deck/index.js";
import { memo, useId, useMemo } from "react";
import { ArchetypeCard, archetypeOptionId } from "./ArchetypeCard.js";
import { ArchetypeCustomDeckCard, customArchetypeOptionId } from "./ArchetypeCustomDeckCard.js";

/**
 * The deck's four slots in display order: the three preset archetypes, then the
 * custom-build slot. Index 3 is always the custom slot.
 */
export const ARCHETYPE_DECK_ENTRIES: readonly (
  | { readonly kind: "preset"; readonly id: string }
  | { readonly kind: "custom" }
)[] = [
  ...ARCHETYPE_PRESETS.map((preset) => ({ kind: "preset" as const, id: preset.id })),
  { kind: "custom" as const },
];

/** Maps a deck index to its option element's DOM id. */
export function archetypeDeckOptionId(listboxId: string, index: number): string {
  const entry = ARCHETYPE_DECK_ENTRIES[index];
  if (entry === undefined) return "";
  return entry.kind === "custom"
    ? customArchetypeOptionId(listboxId)
    : archetypeOptionId(listboxId, entry.id);
}

export interface ArchetypeDeckPaneProps {
  /** Index into `ARCHETYPE_DECK_ENTRIES` of the previewed card. */
  readonly focusedIndex: number;
  /** Focus moved (arrows, wheel, drag-to-fling): previews, commits nothing. */
  readonly onFocusIndex: (index: number) => void;
  /**
   * A card was activated (tap or Enter). The screen resolves the index: a
   * preset slot applies it, the custom slot opens the allocator.
   */
  readonly onActivateIndex: (index: number) => void;
  /** The preset id currently applied, or null when not in preset mode. */
  readonly appliedPresetId: string | null;
  /** Whether a custom build is the currently applied selection. */
  readonly customApplied: boolean;
  /** The committed custom allocation, or null when nothing has been built yet. */
  readonly customAllocation: {
    readonly economy: number;
    readonly industry: number;
    readonly combat: number;
  } | null;
}

/**
 * The master pane of the Choose-your-archetype screen: the three named archetype
 * presets plus the custom-build slot as a deck. Moving focus only previews;
 * Enter or a tap activates the card (applying a preset or opening the
 * allocator for the custom slot).
 */
export const ArchetypeDeckPane = memo(function ArchetypeDeckPane({
  focusedIndex,
  onFocusIndex,
  onActivateIndex,
  appliedPresetId,
  customApplied,
  customAllocation,
}: ArchetypeDeckPaneProps) {
  const listboxId = useId();

  const cards = useMemo(
    () =>
      ARCHETYPE_DECK_ENTRIES.map((entry, index) => {
        const palette = paletteForIndex(index);
        if (entry.kind === "custom") {
          return (
            <ArchetypeCustomDeckCard
              key={entry.kind}
              palette={palette}
              applied={customApplied}
              allocation={customAllocation}
              listboxId={listboxId}
            />
          );
        }
        const preset = ARCHETYPE_PRESETS.find((candidate) => candidate.id === entry.id);
        if (preset === undefined) return null;
        return (
          <ArchetypeCard
            key={preset.id}
            preset={preset}
            palette={palette}
            applied={preset.id === appliedPresetId}
            listboxId={listboxId}
          />
        );
      }),
    [appliedPresetId, customApplied, customAllocation, listboxId],
  );

  const optionIds = useMemo(
    () => ARCHETYPE_DECK_ENTRIES.map((_, index) => archetypeDeckOptionId(listboxId, index)),
    [listboxId],
  );

  return (
    <DeckMasterPane
      listboxId={listboxId}
      eyebrow="Playstyle"
      heading="Archetype"
      instructions={`Drag a card away, scroll, or use the arrow keys to inspect each archetype. Press Enter or tap a preset to apply it; the custom card builds your own ${ARCHETYPE_POINT_TOTAL}-point split.`}
      ariaLabel="Archetype presets"
      hint="Drag · Scroll · ← → · Enter"
      emptyMessage="No archetypes available"
      cards={cards}
      optionIds={optionIds}
      focusedIndex={focusedIndex}
      onFocusIndex={onFocusIndex}
      onActivateIndex={onActivateIndex}
      onConfirmIndex={onActivateIndex}
    />
  );
});
