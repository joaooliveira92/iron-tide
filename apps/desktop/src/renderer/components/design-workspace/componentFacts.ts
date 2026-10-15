import type { ComponentSummary, PartCatalogueEntry } from "@bluewave/ship-design";

export interface ComponentFacts {
  readonly name: string;
  readonly category: string;
  readonly introduced: string;
  readonly obsolete: string | null;
  readonly tags: readonly string[];
  /** Resolved figures for one placed instance; null for a catalogue entry that is not placed. */
  readonly placed: { readonly weightT: number; readonly costGbp: number } | null;
}

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();

/** What the hover card shows for a component. Pure: the weight and cost are the compiler's own, never recomputed here. */
export function componentFacts(
  entry: PartCatalogueEntry,
  summary: ComponentSummary | undefined,
): ComponentFacts {
  return {
    name: entry.displayName,
    category: words(entry.category),
    introduced: entry.introduction.fromMonth,
    obsolete: entry.introduction.obsoleteMonth,
    tags: entry.tags,
    placed:
      summary === undefined
        ? null
        : { weightT: summary.weightKg / 1000, costGbp: summary.costMicro / 1_000_000 },
  };
}

/** Components grouped by category in catalogue order, for the add-component menu. */
export function componentsByCategory(
  entries: readonly PartCatalogueEntry[],
): { readonly category: string; readonly items: readonly PartCatalogueEntry[] }[] {
  const groups = new Map<string, PartCatalogueEntry[]>();
  for (const entry of entries) {
    const key = words(entry.category);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups].map(([category, items]) => ({ category, items }));
}
