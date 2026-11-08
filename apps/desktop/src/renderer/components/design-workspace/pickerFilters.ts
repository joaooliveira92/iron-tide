import { useCallback, useState } from "react";
import {
  UM_PER_INCH,
  type ComponentCategory,
  type PartCatalogueEntry,
  type PickerHiddenReason,
  type PickerQuery,
} from "@bluewave/ship-design";

export interface PickerFilters {
  readonly showAllNations: boolean;
  readonly showUnavailable: boolean;
  readonly role: string | null;
  readonly minCaliberUm: number | null;
}

export const DEFAULT_PICKER_FILTERS: PickerFilters = {
  showAllNations: false,
  showUnavailable: false,
  role: null,
  minCaliberUm: null,
};

export interface PickerContext {
  readonly month: string;
  readonly unlockedTechs: ReadonlySet<string>;
  readonly nationId: string;
}

export const HIDDEN_REASON_LABEL: Readonly<Record<PickerHiddenReason, string>> = {
  not_yet_available: "not yet available",
  obsolete: "obsolete",
  missing_tech: "technology not researched",
  other_nation: "other nation",
  calibre: "below calibre filter",
  role: "other role",
};

export function usePickerFilters(): readonly [
  PickerFilters,
  (patch: Partial<PickerFilters>) => void,
] {
  const [filters, setFilters] = useState<PickerFilters>(DEFAULT_PICKER_FILTERS);
  const patch = useCallback(
    (change: Partial<PickerFilters>) => setFilters((current) => ({ ...current, ...change })),
    [],
  );
  return [filters, patch];
}

export function pickerQueryOf(
  context: PickerContext,
  filters: PickerFilters,
  category?: ComponentCategory,
): PickerQuery {
  return {
    month: context.month,
    unlockedTechs: context.unlockedTechs,
    nationId: context.nationId,
    showAllNations: filters.showAllNations,
    ...(category === undefined ? {} : { category }),
    ...(filters.minCaliberUm === null ? {} : { caliberRange: { minUm: filters.minCaliberUm } }),
    ...(filters.role === null ? {} : { role: filters.role }),
  };
}

export function roleChoices(catalogue: readonly PartCatalogueEntry[]): readonly string[] {
  return [...new Set(catalogue.flatMap((e) => e.roleTags ?? []))].sort();
}

export function caliberChoices(catalogue: readonly PartCatalogueEntry[]): readonly number[] {
  return [
    ...new Set(catalogue.flatMap((e) => (e.caliberUm === undefined ? [] : [e.caliberUm]))),
  ].sort((a, b) => a - b);
}

export function inchesOf(caliberUm: number): number {
  return caliberUm / UM_PER_INCH;
}

export function nationLabel(entry: PartCatalogueEntry): string | null {
  const ids = entry.nationIds;
  if (ids === undefined) return null;
  return ids.length === 1 ? (ids[0] ?? null) : `${ids.length} nations`;
}
