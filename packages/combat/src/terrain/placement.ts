import type { TerrainPoint, TerrainPolygon, TerrainView } from "./model.js";

export interface BattleTerrainRecord {
  readonly areaId: string;
  readonly battleOrigin: TerrainPoint;
  readonly land: readonly TerrainPolygon[];
  readonly shallows: readonly TerrainPolygon[];
  readonly exclusions: readonly {
    readonly id: string;
    readonly xM: number;
    readonly yM: number;
    readonly radiusM: number;
  }[];
}

export function placeBattleTerrain(record: BattleTerrainRecord): TerrainView {
  const { xM: originX, yM: originY } = record.battleOrigin;
  const shift = (polygon: TerrainPolygon): TerrainPolygon => ({
    id: polygon.id,
    vertices: polygon.vertices.map((v) => ({ xM: v.xM - originX, yM: v.yM - originY })),
  });
  return {
    land: record.land.map(shift),
    shallows: record.shallows.map(shift),
    exclusions: record.exclusions.map((zone) => ({
      id: zone.id,
      xM: zone.xM - originX,
      yM: zone.yM - originY,
      radiusM: zone.radiusM,
    })),
  };
}
