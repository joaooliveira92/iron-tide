import { memo, useId, useMemo } from "react";
import { DeckMasterPane, paletteForIndex } from "@/components/card-deck/index.js";
import { FLEET_METHOD_CARDS } from "../../fleet-method-content.js";
import { useFleetMethodActions, useFleetMethodMeta } from "./FleetMethodWorkspaceProvider.js";
import { FleetMethodCard, fleetMethodOptionId } from "./FleetMethodCard.js";

export const FleetMethodDeckPane = memo(function FleetMethodDeckPane() {
  const listboxId = useId();
  const { activeId, focusedIndex } = useFleetMethodMeta().deck;
  const { focusIndex, activateIndex } = useFleetMethodActions();

  const cards = useMemo(
    () =>
      FLEET_METHOD_CARDS.map((card, index) => (
        <FleetMethodCard
          key={card.id}
          card={card}
          palette={paletteForIndex(index)}
          applied={card.id === activeId}
          listboxId={listboxId}
        />
      )),
    [activeId, listboxId],
  );
  const optionIds = useMemo(
    () => FLEET_METHOD_CARDS.map((card) => fleetMethodOptionId(listboxId, card.id)),
    [listboxId],
  );

  return (
    <DeckMasterPane
      listboxId={listboxId}
      eyebrow="Starting Fleet"
      heading="Methods"
      instructions="Drag a card away, scroll, or use the arrow keys to inspect each method. Press Enter or tap a card to select it."
      ariaLabel="Starting-fleet methods"
      hint="Drag · Scroll · ← → · Enter"
      emptyMessage="No fleet methods available"
      cards={cards}
      optionIds={optionIds}
      focusedIndex={focusedIndex}
      onFocusIndex={focusIndex}
      onActivateIndex={activateIndex}
      onConfirmIndex={activateIndex}
    />
  );
});
