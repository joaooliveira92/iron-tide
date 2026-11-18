import type { Position } from "../core/position.js";

export type { Position };

export const TERRAIN_MICROMETRES_PER_METRE = 1_000_000 as const;
export const TERRAIN_COORDINATE_LIMIT_M = 1_000_000 as const;
export const TERRAIN_QUERY_LIMIT_M = 10_000_000 as const;

export const TERRAIN_POSITION_NOT_SAFE_INTEGER = "TERRAIN_POSITION_NOT_SAFE_INTEGER" as const;
export const TERRAIN_QUERY_OUT_OF_RANGE = "TERRAIN_QUERY_OUT_OF_RANGE" as const;

export interface TerrainPoint {
  readonly xM: number;
  readonly yM: number;
}

export interface TerrainPolygon {
  readonly id: string;
  readonly vertices: readonly TerrainPoint[];
}

export interface TerrainExclusion {
  readonly id: string;
  readonly xM: number;
  readonly yM: number;
  readonly radiusM: number;
}

export interface TerrainView {
  readonly land: readonly TerrainPolygon[];
  readonly shallows: readonly TerrainPolygon[];
  readonly exclusions: readonly TerrainExclusion[];
}

export interface CoastPoint {
  readonly polygonId: string;
  readonly edgeIndex: number;
  readonly xM: number;
  readonly yM: number;
  readonly distanceSquaredM: number;
}
