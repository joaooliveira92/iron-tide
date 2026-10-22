import type { KeyboardEvent, ReactNode } from "react";
import { useMemo } from "react";
import { DeckMasterPane, normalizeIndex, paletteForIndex } from "@/components/card-deck/index.js";
import type { PlayableSlotCountryId } from "@/content/nationAssetManifest.js";
import { FleetNationCard } from "./FleetNationCard.js";

interface FleetDispatchBoardProps {
  slots: readonly PlayableSlotCountryId[];
  focusedIndex: number;
  listboxId: string;
  onSelect: (index: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  footerChildren?: ReactNode;
}

export function FleetDispatchBoard({
  slots,
  focusedIndex,
  listboxId,
  onSelect,
  onKeyDown,
  footerChildren,
}: FleetDispatchBoardProps): React.JSX.Element {
  const normalizedFocusedIndex = normalizeIndex(focusedIndex, slots.length);

  const cards = useMemo(
    () =>
      slots.map((countryId, index) => (
        <FleetNationCard
          key={countryId}
          countryId={countryId}
          palette={paletteForIndex(index)}
          active={index === normalizedFocusedIndex}
          listboxId={listboxId}
        />
      )),
    [slots, listboxId, normalizedFocusedIndex],
  );
  const optionIds = useMemo(
    () => slots.map((countryId) => `${listboxId}-option-${countryId}`),
    [slots, listboxId],
  );

  return (
    <DeckMasterPane
      listboxId={listboxId}
      heading="Fleet Dispatch"
      instructions="Drag a card away, scroll, or use the arrow keys to inspect each nation. Press Enter to confirm."
      ariaLabel="Playable nations"
      hint="Drag · Scroll · ↑ ↓ · Enter"
      emptyMessage="No fleet commissions available"
      cards={cards}
      optionIds={optionIds}
      focusedIndex={focusedIndex}
      onFocusIndex={onSelect}
      onActivateIndex={onSelect}
      onKeyDown={onKeyDown}
      footerChildren={footerChildren}
    />
  );
}
