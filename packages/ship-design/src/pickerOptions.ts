import type { ComponentCategory } from "./component.js";
import type { PartCatalogueEntry } from "./partCatalogueView.js";

export type PickerHiddenReason =
  | "not_yet_available"
  | "obsolete"
  | "missing_tech"
  | "other_nation"
  | "calibre"
  | "role";

export interface CaliberRange {
  readonly minUm?: number;
  readonly maxUm?: number;
}

export interface PickerQuery {
  readonly month: string;
  readonly unlockedTechs: ReadonlySet<string>;
  readonly nationId?: string;
  readonly showAllNations?: boolean;
  readonly category?: ComponentCategory;
  readonly caliberRange?: CaliberRange;
  readonly role?: string;
}

export interface HiddenPickerEntry {
  readonly entry: PartCatalogueEntry;
  readonly reason: PickerHiddenReason;
}

export interface PickerOptions {
  readonly available: readonly PartCatalogueEntry[];
  readonly hidden: readonly HiddenPickerEntry[];
}

function inCaliberRange(entry: PartCatalogueEntry, range: CaliberRange | undefined): boolean {
  if (range === undefined || (range.minUm === undefined && range.maxUm === undefined)) return true;
  const caliber = entry.caliberUm;
  if (caliber === undefined) return false;
  return (
    (range.minUm === undefined || caliber >= range.minUm) &&
    (range.maxUm === undefined || caliber <= range.maxUm)
  );
}

function hiddenReason(
  entry: PartCatalogueEntry,
  query: PickerQuery,
): PickerHiddenReason | undefined {
  if (entry.introduction.fromMonth > query.month) return "not_yet_available";
  const obsolete = entry.introduction.obsoleteMonth;
  if (obsolete !== null && obsolete <= query.month) return "obsolete";
  if (entry.requires.some((tech) => !query.unlockedTechs.has(tech))) return "missing_tech";
  if (
    query.showAllNations !== true &&
    query.nationId !== undefined &&
    entry.nationIds !== undefined &&
    !entry.nationIds.includes(query.nationId)
  ) {
    return "other_nation";
  }
  if (!inCaliberRange(entry, query.caliberRange)) return "calibre";
  if (query.role !== undefined && !(entry.roleTags ?? []).includes(query.role)) return "role";
  return undefined;
}

export function pickerOptions(
  catalogue: readonly PartCatalogueEntry[],
  query: PickerQuery,
): PickerOptions {
  const available: PartCatalogueEntry[] = [];
  const hidden: HiddenPickerEntry[] = [];
  for (const entry of catalogue) {
    if (query.category !== undefined && entry.category !== query.category) continue;
    const reason = hiddenReason(entry, query);
    if (reason === undefined) available.push(entry);
    else hidden.push({ entry, reason });
  }
  return { available, hidden };
}
