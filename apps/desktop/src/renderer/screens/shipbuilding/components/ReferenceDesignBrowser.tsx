import { useCallback, useId, useMemo, useState } from "react";
import {
  nationProfileBrief,
  type StarterDesign,
  type WorkshopEnvironment,
} from "@bluewave/ship-design";
import { DeckMasterPane, paletteForIndex } from "@/components/card-deck/index.js";
import type { DrawingBoardContent } from "../../../components/design-workspace/content.js";
import { NationalIdentityPanel } from "../../../components/design-workspace/index.js";
import { referenceDeck } from "../reference-deck.js";
import { ReferenceDeckCard, referenceOptionId } from "./ReferenceDeckCard.js";
import { ReferenceDeckDetail } from "./ReferenceDeckDetail.js";

export function ReferenceDesignBrowser({
  env,
  starters,
  content,
  month,
  currentCategory,
  onStart,
}: {
  readonly env: WorkshopEnvironment;
  readonly starters: readonly StarterDesign[];
  readonly content: DrawingBoardContent;
  readonly month: string;
  readonly currentCategory: string;
  readonly onStart: (starterId: string) => void;
}) {
  const listboxId = useId();
  const deck = useMemo(
    () => referenceDeck(env, starters, currentCategory),
    [env, starters, currentCategory],
  );
  const [focusedIndex, setFocusedIndex] = useState(deck.initialIndex);
  const count = deck.entries.length;
  const index = count === 0 ? 0 : ((focusedIndex % count) + count) % count;
  const focused = deck.entries[index];

  const cards = useMemo(
    () =>
      deck.entries.map((entry, i) => (
        <ReferenceDeckCard
          key={entry.definition.id}
          entry={entry}
          palette={paletteForIndex(i)}
          listboxId={listboxId}
          env={env}
          content={content}
          month={month}
        />
      )),
    [deck, listboxId, env, content, month],
  );
  const optionIds = useMemo(
    () => deck.entries.map((e) => referenceOptionId(listboxId, e.definition.id)),
    [deck, listboxId],
  );
  const confirm = useCallback(
    (i: number) => {
      const entry = deck.entries[i];
      setFocusedIndex(i);
      if (entry?.startable && entry.starter !== null) onStart(entry.starter.id);
    },
    [deck, onStart],
  );
  const profile = env.ctx.navalProfile;

  return (
    <div
      data-testid="reference-design-browser"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border lg:flex-row"
    >
      <DeckMasterPane
        listboxId={listboxId}
        eyebrow="Reference designs"
        heading="Ship types"
        instructions="Drag a card away, scroll, or use the arrow keys to inspect each ship type. Press Enter to start from its design."
        ariaLabel="Ship types"
        hint="Drag · Scroll · ← → · Enter"
        emptyMessage="No ship types available"
        cards={cards}
        optionIds={optionIds}
        focusedIndex={index}
        onFocusIndex={setFocusedIndex}
        onActivateIndex={setFocusedIndex}
        onConfirmIndex={confirm}
      />
      <section
        aria-label="Ship type details"
        className="themed-scrollbar min-w-0 flex-1 overflow-y-auto"
      >
        <div className="flex flex-col gap-4 p-5">
          {focused !== undefined && (
            <ReferenceDeckDetail key={focused.definition.id} entry={focused} onStart={onStart} />
          )}
          {deck.lockedCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Other kinds of ship are not available in this era.
            </p>
          )}
          {profile !== undefined && <NationalIdentityPanel brief={nationProfileBrief(profile)} />}
        </div>
      </section>
    </div>
  );
}
