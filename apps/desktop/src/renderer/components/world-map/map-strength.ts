import type { FleetPlacement } from "./map-markers.js";

export const FLAG_CLUSTER_LIMIT = 3;

const BAR_MIN = 6;
export const BAR_MAX = 44;
const BAR_MIN_COMPACT = 5;
export const BAR_MAX_COMPACT = 28;
export const COMPACT_BELOW_PX = 600;

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
  readonly total: number;
  readonly fraction: number;
  readonly nations: readonly NationStrength[];
  readonly flags: readonly NationStrength[];
  readonly overflow: number;
  readonly overflowShips: number;
}

export interface StrengthOptions {
  readonly nameFor: (nation: string | null) => string;
  readonly flagUrlFor: (nation: string | null) => string | null;
}

function shipsOf(fleet: FleetPlacement): number {
  return Number.isFinite(fleet.ships) && fleet.ships > 0 ? Math.floor(fleet.ships) : 0;
}

function byStrength(a: NationStrength, b: NationStrength): number {
  if (a.ships !== b.ships) return b.ships - a.ships;
  if (a.nation === b.nation) return 0;
  if (a.nation === null) return 1;
  if (b.nation === null) return -1;
  return a.nation < b.nation ? -1 : 1;
}

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

export function barHeight(fraction: number, compact = false): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  const [min, max] = compact ? [BAR_MIN_COMPACT, BAR_MAX_COMPACT] : [BAR_MIN, BAR_MAX];
  return Math.round(min + (max - min) * clamped);
}

function shipCount(count: number): string {
  return count === 1 ? "1 ship" : `${count} ships`;
}

export function describeStrength(region: RegionStrength): string {
  const nations = region.nations.map((entry) => `${entry.name} ${entry.ships}`).join(", ");
  return `strength ${shipCount(region.total)} (${nations})`;
}
