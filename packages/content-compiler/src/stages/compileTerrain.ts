import type {
  CompiledTerrain,
  CompiledTerrainRecord,
  TerrainArea,
  TerrainPolygonSource,
} from "@bluewave/content-schema";
import { TERRAIN_VERSION } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";

import type { TerrainValidated } from "./validateTerrain.js";

function polygonsOf(area: TerrainArea, layer: TerrainPolygonSource["layer"]) {
  return area.polygons
    .filter((polygon) => polygon.layer === layer)
    .map((polygon) => ({ id: polygon.id, vertices: polygon.vertices }))
    .sort((a, b) => compareCodePoints(a.id, b.id));
}

function recordOf(area: TerrainArea, radiusM: number): CompiledTerrainRecord {
  return {
    areaId: area.areaId,
    box: area.box,
    land: polygonsOf(area, "LAND"),
    shallows: polygonsOf(area, "SHALLOWS"),
    exclusions: [...area.bases]
      .sort((a, b) => compareCodePoints(a.portId, b.portId))
      .map((base) => ({
        id: `exclusion.${base.portId}`,
        portId: base.portId,
        xM: base.xM,
        yM: base.yM,
        radiusM,
      })),
  };
}

export function compileTerrain(validated: TerrainValidated): CompiledTerrain {
  return {
    terrainVersion: TERRAIN_VERSION,
    rules: validated.rules,
    records: [...validated.areas]
      .sort((a, b) => compareCodePoints(a.areaId, b.areaId))
      .map((area) => recordOf(area, validated.rules.exclusionRadiusM)),
  };
}
