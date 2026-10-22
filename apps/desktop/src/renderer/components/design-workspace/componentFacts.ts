import type { ComponentSummary, PartCatalogueEntry } from "@bluewave/ship-design";

export interface ComponentFacts {
  readonly name: string;
  readonly category: string;
  readonly introduced: string;
  readonly obsolete: string | null;
  readonly tags: readonly string[];
  readonly placed: { readonly weightT: number; readonly costGbp: number } | null;
}

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();

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
