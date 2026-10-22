import {
  isShipTypeId,
  SHIP_TYPE_LIST,
  SHIP_TYPES,
  type NationNavalProfile,
  type ShipTypeId,
} from "@bluewave/ship-design";

export type NamingProfile = Pick<NationNavalProfile, "namingPolicy">;

export interface NameGroup {
  readonly type: string;
  readonly label: string;
  readonly names: readonly string[];
  readonly current: boolean;
}

const labelOf = (type: string) =>
  isShipTypeId(type) ? `${type} · ${SHIP_TYPES[type].name}` : type;

export function namePoolFor(
  profile: NamingProfile | undefined,
  shipType: string,
): readonly string[] {
  if (profile === undefined || !isShipTypeId(shipType)) return [];
  return profile.namingPolicy.stems[shipType] ?? [];
}

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
