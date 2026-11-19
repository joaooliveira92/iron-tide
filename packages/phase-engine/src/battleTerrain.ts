import type { TacticalMinefieldRecord } from "@bluewave/combat/collision";
import type { TerrainView } from "@bluewave/combat/terrain";

export function battleTerrainOf(
  terrain: Readonly<Record<string, TerrainView>> | undefined,
  areaId: string,
): { terrain?: TerrainView } {
  const view =
    terrain === undefined
      ? undefined
      : Object.hasOwn(terrain, areaId)
        ? terrain[areaId]
        : undefined;
  return view === undefined ? {} : { terrain: view };
}

export function battleMinefieldsOf(
  minefields: Readonly<Record<string, readonly TacticalMinefieldRecord[]>> | undefined,
  areaId: string,
): { minefields?: readonly TacticalMinefieldRecord[] } {
  const records =
    minefields !== undefined && Object.hasOwn(minefields, areaId) ? minefields[areaId] : undefined;
  return records === undefined || records.length === 0 ? {} : { minefields: records };
}
