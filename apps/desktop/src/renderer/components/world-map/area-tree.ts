/**
 * View-model for the area tree panel (CC-4): production areas grouped under display
 * regions, with the Ships / Possessions lens. Pure: no React, no bridge.
 */
import {
  areaRegion,
  fixtureAreaId,
  presentationRegions,
} from "../../content/presentationContent.js";
import type { CampaignAreaEntry } from "./campaign-map-join.js";

export type AreaTreeMode = "ships" | "possessions";

/** Area ids with no region sit under this label rather than vanishing (fixture fallback, future areas). */
export const OTHER_REGION_LABEL = "Other waters";

export interface AreaTreeRow {
  readonly id: string;
  readonly name: string;
  /** Controlling nation's display name, or null when unclaimed. */
  readonly owner: string | null;
  /** The player's ships in this area. */
  readonly ships: number;
  /** True when the player controls this area. */
  readonly possessed: boolean;
  /** The map area a click selects and focuses, or null when the area has no geometry. */
  readonly mapAreaId: string | null;
  readonly selected: boolean;
}

export interface AreaTreeGroup {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly AreaTreeRow[];
  /** Header badge: ship count in Ships mode, area count in Possessions mode. */
  readonly badge: number;
  readonly expanded: boolean;
}

export const OTHER_GROUP_ID = "other";

/** One row per campaign area, with the player's ships and holdings resolved. */
export function campaignTreeRows(
  areas: readonly CampaignAreaEntry[],
  playerNationId: string | null,
  ownerLabel: (nationId: string) => string,
  selectedMapAreaId: string | null,
): AreaTreeRow[] {
  return areas.map((area) => {
    const mapAreaId = fixtureAreaId(area.id);
    return {
      id: area.id,
      name: area.name,
      owner: area.controller === null ? null : ownerLabel(area.controller),
      ships:
        playerNationId === null
          ? 0
          : area.fleets
              .filter((fleet) => fleet.nation === playerNationId)
              .reduce((sum, fleet) => sum + fleet.ships, 0),
      possessed: playerNationId !== null && area.controller === playerNationId,
      mapAreaId,
      selected: mapAreaId !== null && mapAreaId === selectedMapAreaId,
    };
  });
}

function matches(row: AreaTreeRow, needle: string): boolean {
  return (
    row.name.toLowerCase().includes(needle) ||
    (row.owner ?? "unclaimed").toLowerCase().includes(needle)
  );
}

export interface BuildAreaTreeInput {
  readonly rows: readonly AreaTreeRow[];
  readonly mode: AreaTreeMode;
  readonly query: string;
  /** Group ids the player opened (or closed) explicitly. */
  readonly toggled: ReadonlySet<string>;
}

/**
 * Regions in display order, each holding the rows that pass the lens and the filter.
 * Empty regions are dropped. A group is open when it holds the selected row or any filter
 * match, unless the player toggled it, which flips that default.
 */
export function buildAreaTree(input: BuildAreaTreeInput): AreaTreeGroup[] {
  const needle = input.query.trim().toLowerCase();
  const regionsByArea = areaRegion();
  const declaredRegions = presentationRegions();
  const lens = input.rows.filter((row) => (input.mode === "ships" ? row.ships > 0 : row.possessed));
  const visible = needle === "" ? lens : lens.filter((row) => matches(row, needle));

  const buckets = new Map<string, AreaTreeRow[]>();
  for (const row of visible) {
    const key = regionsByArea[row.id] ?? OTHER_GROUP_ID;
    const bucket = buckets.get(key);
    if (bucket === undefined) buckets.set(key, [row]);
    else bucket.push(row);
  }

  const order = [
    ...declaredRegions.map((r) => ({ id: r.id, label: r.label })),
    {
      id: OTHER_GROUP_ID,
      label: OTHER_REGION_LABEL,
    },
  ];
  const groups: AreaTreeGroup[] = [];
  for (const region of order) {
    const rows = buckets.get(region.id);
    if (rows === undefined) continue;
    const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    const byDefault = needle !== "" || sorted.some((row) => row.selected);
    groups.push({
      id: region.id,
      label: region.label,
      rows: sorted,
      badge:
        input.mode === "ships" ? sorted.reduce((sum, row) => sum + row.ships, 0) : sorted.length,
      expanded: input.toggled.has(region.id) ? !byDefault : byDefault,
    });
  }
  return groups;
}
