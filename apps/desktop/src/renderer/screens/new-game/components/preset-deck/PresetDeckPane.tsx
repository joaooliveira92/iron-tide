import { memo, useCallback, useId, useMemo } from "react";
import { DeckMasterPane, paletteForIndex } from "@/components/card-deck/index.js";
import {
  PRESET_DEFINITIONS,
  type ActivePresetId,
  type PresetId,
} from "../../rules-of-the-naval-age-presets.js";
import { PresetCard, presetOptionId } from "./PresetCard.js";

export interface PresetDeckPaneProps {
  /** The preset whose bundle is currently applied, or `custom`. */
  readonly activePreset: ActivePresetId;
  /** Index into `PRESET_DEFINITIONS` of the previewed card. */
  readonly focusedIndex: number;
  /** Focus moved (arrows, wheel, drag-to-fling): previews, commits nothing. */
  readonly onFocusIndex: (index: number) => void;
  /** Enter or a tap: applies the preset. */
  readonly onSelectPreset: (presetId: PresetId) => void;
}

/**
 * The master pane of the Rules-of-the-Naval-Age screen: the four preset bundles
 * as a deck. Moving focus only previews; Enter or a tap applies the preset.
 */
export const PresetDeckPane = memo(function PresetDeckPane({
  activePreset,
  focusedIndex,
  onFocusIndex,
  onSelectPreset,
}: PresetDeckPaneProps) {
  const listboxId = useId();

  const cards = useMemo(
    () =>
      PRESET_DEFINITIONS.map((preset, index) => (
        <PresetCard
          key={preset.id}
          preset={preset}
          palette={paletteForIndex(index)}
          applied={preset.id === activePreset}
          listboxId={listboxId}
        />
      )),
    [activePreset, listboxId],
  );
  const optionIds = useMemo(
    () => PRESET_DEFINITIONS.map((preset) => presetOptionId(listboxId, preset.id)),
    [listboxId],
  );

  const selectIndex = useCallback(
    (index: number) => {
      const preset = PRESET_DEFINITIONS[index];
      if (preset === undefined) return;
      onFocusIndex(index);
      onSelectPreset(preset.id);
    },
    [onFocusIndex, onSelectPreset],
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
      onFocusIndex={onFocusIndex}
      onActivateIndex={selectIndex}
      onConfirmIndex={selectIndex}
    />
  );
});
