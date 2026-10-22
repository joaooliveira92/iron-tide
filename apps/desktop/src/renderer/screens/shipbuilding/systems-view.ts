import type {
  ComponentCategory,
  DesignDraft,
  DraftEdit,
  PartCatalogueEntry,
  ZoneId,
} from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../components/design-workspace/content.js";

export interface SystemItem {
  readonly componentId: string;
  readonly name: string;
  readonly available: boolean;
  readonly reason: string | null;
  readonly fitted: number;
}

export interface SystemGroup {
  readonly category: ComponentCategory;
  readonly label: string;
  readonly items: readonly SystemItem[];
}

const words = (s: string) => s.replaceAll("_", " ").toLowerCase();

export function unavailableReason(
  entry: PartCatalogueEntry,
  month: string,
  unlockedTechs: ReadonlySet<string>,
): string | null {
  if (entry.introduction.fromMonth > month)
    return `Unavailable until ${entry.introduction.fromMonth}`;
  const missing = entry.requires.filter((t) => !unlockedTechs.has(t));
  if (missing.length > 0) return `Requires ${missing.map(words).join(", ")}`;
  return null;
}

export function systemsModel(
  categories: ReadonlySet<ComponentCategory>,
  draft: DesignDraft,
  content: DrawingBoardContent,
  month: string,
  unlockedTechs: ReadonlySet<string>,
  showUnavailable: boolean,
): SystemGroup[] {
  const fittedCount = new Map<string, number>();
  for (const p of draft.placements)
    fittedCount.set(p.componentId, (fittedCount.get(p.componentId) ?? 0) + 1);
  const groups = new Map<ComponentCategory, SystemItem[]>();
  for (const entry of content.catalogue) {
    if (!categories.has(entry.category)) continue;
    const reason = unavailableReason(entry, month, unlockedTechs);
    if (reason !== null && !showUnavailable) continue;
    groups.set(entry.category, [
      ...(groups.get(entry.category) ?? []),
      {
        componentId: entry.id,
        name: entry.displayName,
        available: reason === null,
        reason,
        fitted: fittedCount.get(entry.id) ?? 0,
      },
    ]);
  }
  return [...groups].map(([category, items]) => ({ category, label: words(category), items }));
}

function midStation(content: DrawingBoardContent, draft: DesignDraft, zoneId: string): number {
  const z = content.hullForms
    .find((f) => f.id === draft.hull.hullFormId)
    ?.zones.find((q) => q.id === zoneId);
  return z ? Math.floor((z.startPermille + z.endPermille) / 2) : 500;
}

export function addSystemEdit(
  componentId: string,
  draft: DesignDraft,
  content: DrawingBoardContent,
): DraftEdit | null {
  const entry = content.catalogue.find((e) => e.id === componentId);
  if (entry === undefined) return null;
  const zoneId = (entry.allowedZones?.[0] ?? "SUPERSTRUCTURE") as ZoneId;
  let n = 1;
  while (draft.placements.some((p) => p.instanceId === `${componentId}_${n}`)) n++;
  return {
    kind: "add_placement",
    placement: {
      instanceId: `${componentId}_${n}`,
      componentId,
      zoneId,
      stationPermille: midStation(content, draft, zoneId),
    },
  };
}
