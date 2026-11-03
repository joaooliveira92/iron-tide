import { memo, useId, useMemo } from "react";
import { DeckMasterPane, paletteForIndex } from "@/components/card-deck/index.js";
import { PRESET_DEFINITIONS } from "../../rules-of-the-naval-age-presets.js";
import { PresetCard, presetOptionId } from "./PresetCard.js";
import { usePresetActions, usePresetMeta } from "./PresetWorkspaceProvider.js";

export const PresetDeckPane = memo(function PresetDeckPane() {
  const listboxId = useId();
  const { activePresetId, focusedIndex } = usePresetMeta().deck;
  const { focusIndex, activateIndex } = usePresetActions();

  const cards = useMemo(
    () =>
      PRESET_DEFINITIONS.map((preset, index) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          palette={paletteForIndex(index)}
          applied={preset.id === activePresetId}
          listboxId={listboxId}
        />
      )),
    [activePresetId, listboxId],
  );
  const optionIds = useMemo(
    () => PRESET_DEFINITIONS.map((preset) => presetOptionId(listboxId, preset.id)),
    [listboxId],
  );

  return (
    <DeckMasterPane
      listboxId={listboxId}
      eyebrow="Campaign Rules"
      heading="Presets"
      instructions="Drag a card away, scroll, or use the arrow keys to inspect each preset. Press Enter or tap a card to apply it."
      ariaLabel="Campaign presets"
      hint="Drag · Scroll · ← → · Enter"
      emptyMessage="No presets available"
      cards={cards}
      optionIds={optionIds}
      focusedIndex={focusedIndex}
      onFocusIndex={focusIndex}
      onActivateIndex={activateIndex}
      onConfirmIndex={activateIndex}
    />
  );
});
