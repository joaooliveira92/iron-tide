/**
 * Regional naval strength for the strategic map. Pure (no React, no DOM).
 *
 * The only strength the world model carries is ships present: the fleets the
 * active source already places on each region. So a region's strength is the
 * ships of every nation stationed there, and nothing else is derived or
 * invented — a region with no ships has no strength and no glyph.
 *
 * Everything that must be reproducible lives here rather than in a component:
 * the ordering of nations (ships descending, then nation id, unclaimed last),
 * the normalisation of bars against the strongest region, and the cap on the
 * flag cluster with its overflow count.
 */

import type { FleetPlacement } from "./map-markers.js";

/** Flags drawn in a region's cluster; further nations collapse into "+N". */
export const FLAG_CLUSTER_LIMIT = 3;

/** Bar height in screen pixels: the weakest drawn region, and the strongest. */
const BAR_MIN = 6;
export const BAR_MAX = 44;
/** On a small map the regions sit closer together, so bars are shorter. */
const BAR_MIN_COMPACT = 5;
export const BAR_MAX_COMPACT = 28;
/** A map shorter than this (CSS px) is "small": the stacked layout at the minimum window. */
export const COMPACT_BELOW_PX = 600;

/** Whether glyphs use the compact scale; a map that has not been laid out yet (0) is not small. */
export function compactGlyphs(mapHeightPx: number): boolean {
  return mapHeightPx > 0 && mapHeightPx < COMPACT_BELOW_PX;
}

export interface NationStrength {
  readonly nation: string | null;
  readonly name: string;
  readonly flagUrl: string | null;
  readonly ships: number;
}

export interface RegionStrength {
  readonly areaId: string;
  /** Ships of every nation in the region. */
  readonly total: number;
  /** `total` relative to the strongest region on the map, in (0, 1]. */
  readonly fraction: number;
  /** Every nation present, strongest first. */
  readonly nations: readonly NationStrength[];
  /** The first `FLAG_CLUSTER_LIMIT` nations, for the flag cluster. */
  readonly flags: readonly NationStrength[];
  /** Nations present beyond the cluster, and their combined ships. */
  readonly overflow: number;
  readonly overflowShips: number;
}

export interface StrengthOptions {
  readonly nameFor: (nation: string | null) => string;
  readonly flagUrlFor: (nation: string | null) => string | null;
}

/** A ship count is a non-negative integer; anything else is no ships. */
function shipsOf(fleet: FleetPlacement): number {
  return Number.isFinite(fleet.ships) && fleet.ships > 0 ? Math.floor(fleet.ships) : 0;
}

/** Strongest first; equal strength by nation id; the unclaimed sort last. */
function byStrength(a: NationStrength, b: NationStrength): number {
  if (a.ships !== b.ships) return b.ships - a.ships;
  if (a.nation === b.nation) return 0;
  if (a.nation === null) return 1;
  if (b.nation === null) return -1;
  return a.nation < b.nation ? -1 : 1;
}

/**
 * One entry per region that holds at least one ship, ordered by area id. The
 * result does not depend on the order of `fleets`.
 */
export function buildRegionStrengths(
  fleets: readonly FleetPlacement[],
  options: StrengthOptions,
): RegionStrength[] {
  const perArea = new Map<string, Map<string | null, number>>();
  for (const fleet of fleets) {
    const ships = shipsOf(fleet);
    if (ships === 0) continue;
    const nations = perArea.get(fleet.area) ?? new Map<string | null, number>();
    nations.set(fleet.owner, (nations.get(fleet.owner) ?? 0) + ships);
    perArea.set(fleet.area, nations);
  }

  const totals = new Map<string, number>();
  for (const [area, nations] of perArea) {
    totals.set(
      area,
      [...nations.values()].reduce((sum, ships) => sum + ships, 0),
    );
  }
  const strongest = Math.max(0, ...totals.values());

  return [...perArea.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((areaId) => {
      const nations = [...(perArea.get(areaId) ?? [])]
        .map(([nation, ships]) => ({
          nation,
          name: options.nameFor(nation),
          flagUrl: options.flagUrlFor(nation),
          ships,
        }))
        .sort(byStrength);
      const flags = nations.slice(0, FLAG_CLUSTER_LIMIT);
      const rest = nations.slice(FLAG_CLUSTER_LIMIT);
      const total = totals.get(areaId) ?? 0;
      return {
        areaId,
        total,
        fraction: strongest === 0 ? 0 : total / strongest,
        nations,
        flags,
        overflow: rest.length,
        overflowShips: rest.reduce((sum, entry) => sum + entry.ships, 0),
      };
    });
}

/** Bar height in screen pixels for a normalised strength: linear, never a sliver. */
export function barHeight(fraction: number, compact = false): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  const [min, max] = compact ? [BAR_MIN_COMPACT, BAR_MAX_COMPACT] : [BAR_MIN, BAR_MAX];
  return Math.round(min + (max - min) * clamped);
}

function shipCount(count: number): string {
  return count === 1 ? "1 ship" : `${count} ships`;
}

/** The strength as words, so it never depends on bar height, colour or flag art. */
export function describeStrength(region: RegionStrength): string {
  const nations = region.nations.map((entry) => `${entry.name} ${entry.ships}`).join(", ");
  return `strength ${shipCount(region.total)} (${nations})`;
}
