import {
  buildShipTypeRoster,
  type DesignDraft,
  type RosterEntry,
  type StarterDesign,
  type WorkshopEnvironment,
} from "@bluewave/ship-design";

/** One card of the reference-design deck: an available ship type and its starter design. */
export interface ReferenceDeckEntry extends RosterEntry {
  /** The starter's own draft, drawn on the card; null when the type has no starter yet. */
  readonly draft: DesignDraft | null;
  /** The type of the design being edited. */
  readonly current: boolean;
  /** A legal starter exists, so the player can start from it. */
  readonly startable: boolean;
}

export interface ReferenceDeck {
  readonly entries: readonly ReferenceDeckEntry[];
  /** The card the deck opens on: the current design's type, else the first. */
  readonly initialIndex: number;
  /** Types the campaign does not allow yet (not listed; the dialog says more arrive later). */
  readonly lockedCount: number;
}

/**
 * The reference-design deck: the ship types the campaign allows now, in roster order, each with its starter design.
 * Pure: every number on a card or in the detail is read from the domain roster, never restated.
 */
export function referenceDeck(
  env: WorkshopEnvironment,
  starters: readonly StarterDesign[],
  currentCategory: string,
): ReferenceDeck {
  const roster = buildShipTypeRoster(env, starters);
  const entries = roster
    .filter((e) => e.availability.available)
    .map((e): ReferenceDeckEntry => ({
      ...e,
      draft:
        e.starter === null ? null : (starters.find((s) => s.id === e.starter!.id)?.draft ?? null),
      current: e.definition.id === currentCategory,
      startable: e.starter !== null && e.starter.legal,
    }));
  const current = entries.findIndex((e) => e.current);
  return {
    entries,
    initialIndex: current === -1 ? 0 : current,
    lockedCount: roster.length - entries.length,
  };
}
