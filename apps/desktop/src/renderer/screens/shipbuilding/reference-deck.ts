import {
  buildShipTypeRoster,
  type DesignDraft,
  type RosterEntry,
  type StarterDesign,
  type WorkshopEnvironment,
} from "@bluewave/ship-design";

export interface ReferenceDeckEntry extends RosterEntry {
  readonly draft: DesignDraft | null;
  readonly current: boolean;
  readonly startable: boolean;
}

export interface ReferenceDeck {
  readonly entries: readonly ReferenceDeckEntry[];
  readonly initialIndex: number;
  readonly lockedCount: number;
}

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
