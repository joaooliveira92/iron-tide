import { addProtocol } from "maplibre-gl";
import { BAKED_PROTOCOL, createBakedTileLoader } from "../globe-spike/baked-tiles.js";
import type { LandPlan } from "../globe-spike/use-land-plan.js";
import { tileCacheKey, type TileCache, type TileHierarchy } from "./tile-hierarchy.js";

export interface BakedProtocolInput {
  readonly tiles: Extract<LandPlan, { readonly kind: "baked" }>["tiles"];
  readonly hierarchy: TileHierarchy;
  readonly cache: TileCache;
  readonly errors: string[];
}

export function registerBakedProtocol({ tiles, hierarchy, cache, errors }: BakedProtocolInput) {
  const baseLoader = createBakedTileLoader(tiles.pack, tiles.diagnostics);
  addProtocol(BAKED_PROTOCOL, async (params) => {
    const match = /(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
    if (match === null) return baseLoader(params);
    const key = tileCacheKey(
      { z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) },
      hierarchy,
    );
    if (cache.get(key) !== null) return baseLoader(params);
    if (!cache.begin(key)) {
      errors.push(`tile cache in-flight budget reached at ${params.url}`);
      return { data: new ArrayBuffer(0) };
    }
    try {
      const response = await baseLoader(params);
      cache.complete(key, response.data.byteLength);
      return response;
    } catch (error) {
      cache.fail(key);
      throw error;
    }
  });
}
