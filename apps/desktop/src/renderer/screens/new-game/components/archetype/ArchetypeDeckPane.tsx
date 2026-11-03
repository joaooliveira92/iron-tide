import { ARCHETYPE_POINT_TOTAL, ARCHETYPE_PRESETS } from "@bluewave/campaign-engine";
import { memo, useId, useMemo } from "react";
import { DeckMasterPane, paletteForIndex } from "@/components/card-deck/index.js";
import { ArchetypeCard } from "./ArchetypeCard.js";
import { ArchetypeCustomDeckCard } from "./ArchetypeCustomDeckCard.js";
import { ARCHETYPE_DECK_ENTRIES, archetypeDeckOptionId } from "./archetype-deck-entries.js";
import { useArchetypeActions, useArchetypeMeta } from "./ArchetypeWorkspaceProvider.js";

export const ArchetypeDeckPane = memo(function ArchetypeDeckPane() {
  const listboxId = useId();
  const { focusedIndex, appliedPresetId, customApplied, customAllocation } =
    useArchetypeMeta().deck;
  const { focusIndex, activateIndex } = useArchetypeActions();

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
      onFocusIndex={focusIndex}
      onActivateIndex={activateIndex}
      onConfirmIndex={activateIndex}
    />
  );
});
