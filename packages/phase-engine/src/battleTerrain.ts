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
