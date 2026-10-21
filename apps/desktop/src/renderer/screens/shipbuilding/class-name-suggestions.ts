import {
  isShipTypeId,
  SHIP_TYPE_LIST,
  SHIP_TYPES,
  type NationNavalProfile,
  type ShipTypeId,
} from "@bluewave/ship-design";

/** The part of a naval profile the name lists read. */
export type NamingProfile = Pick<NationNavalProfile, "namingPolicy">;

/** One ship type's authored names for the designing nation. */
export interface NameGroup {
  readonly type: string;
  /** e.g. "B · Battleship". */
  readonly label: string;
  readonly names: readonly string[];
  /** True for the type of the design being edited. */
  readonly current: boolean;
}

const labelOf = (type: string) =>
  isShipTypeId(type) ? `${type} · ${SHIP_TYPES[type].name}` : type;

/** The nation's authored name stems for a ship type, in authored order; empty when the profile is silent. */
export function namePoolFor(
  profile: NamingProfile | undefined,
  shipType: string,
): readonly string[] {
  if (profile === undefined || !isShipTypeId(shipType)) return [];
  return profile.namingPolicy.stems[shipType] ?? [];
}

/**
 * Every authored name the nation has, grouped by ship type: the design's own type first, then the others in the
 * registry's order. Types with no names are left out. Pure: the same profile always yields the same groups.
 */
export function nameGroups(
  profile: NamingProfile | undefined,
  shipType: string,
): readonly NameGroup[] {
  if (profile === undefined) return [];
  const order: readonly ShipTypeId[] = SHIP_TYPE_LIST.map((t) => t.id);
  const groups = order
    .map((type): NameGroup => ({
      type,
      label: labelOf(type),
      names: profile.namingPolicy.stems[type] ?? [],
      current: type === shipType,
    }))
    .filter((g) => g.names.length > 0);
  return [...groups.filter((g) => g.current), ...groups.filter((g) => !g.current)];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The next suggested class name from `pool`, starting at `cursor` and skipping the name already in the field, so
 * pressing Suggest always changes it. Deterministic: no randomness, the cursor is the only state. Null when the pool
 * is empty. `cursor` is the position to resume from the next time.
 */
export function suggestClassName(
  pool: readonly string[],
  current: string,
  cursor: number,
): { readonly name: string; readonly cursor: number } | null {
  const n = pool.length;
  if (n === 0) return null;
  for (let step = 0; step < n; step++) {
    const i = (cursor + step) % n;
    const name = pool[i]!;
    if (n === 1 || !same(name, current)) return { name, cursor: (i + 1) % n };
  }
  return null;
}
