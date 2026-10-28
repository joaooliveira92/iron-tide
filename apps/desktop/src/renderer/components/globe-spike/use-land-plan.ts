import { useEffect, useState } from "react";

import { decodeCoastline } from "../../lib/coastline-codec.js";
import { loadBakedTiles, subtleDigest, type BakedTiles } from "./baked-tiles.js";
import { coastlineCollection, type GeoFeatureCollection } from "./globe-spike-scene.js";
import type { LandMode } from "./globe-spike-flag.js";

export type LandPlan =
  | { readonly kind: "loading" }
  | { readonly kind: "baked"; readonly tiles: BakedTiles }
  | {
      readonly kind: "runtime";
      readonly coast: GeoFeatureCollection;
      readonly reason: string | null;
    }
  | { readonly kind: "failed"; readonly reason: string };

const TILE_DIRECTORIES: Record<LandMode, string> = {
  baked: "land-tiles",
  runtime: "land-tiles",
  missing: "land-tiles-missing",
  corrupt: "land-tiles-corrupt",
};

function baseDirectory(): string {
  const href = document.baseURI;
  return href.slice(0, href.lastIndexOf("/") + 1);
}

async function loadRuntimeCoast(): Promise<GeoFeatureCollection> {
  const { COASTLINE_BASE64 } = await import("../world-map/coastline-data.js");
  const binary = atob(COASTLINE_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return coastlineCollection(decodeCoastline(bytes.buffer));
}

export function useLandPlan(mode: LandMode): LandPlan {
  const [plan, setPlan] = useState<LandPlan>({ kind: "loading" });
  useEffect(() => {
    let active = true;
    const settle = (next: LandPlan) => {
      if (active) setPlan(next);
    };
    const fallback = (reason: string | null) =>
      loadRuntimeCoast().then(
        (coast) => settle({ kind: "runtime", coast, reason }),
        (error: unknown) =>
          settle({
            kind: "failed",
            reason: error instanceof Error ? error.message : "Coastline failed to load",
          }),
      );
    if (mode === "runtime") {
      void fallback(null);
    } else {
      loadBakedTiles(
        `${baseDirectory()}map-spike/${TILE_DIRECTORIES[mode]}/`,
        (url) => fetch(url),
        subtleDigest,
        () => performance.now(),
      ).then(
        (tiles) => settle({ kind: "baked", tiles }),
        (error: unknown) => fallback(error instanceof Error ? error.message : String(error)),
      );
    }
    return () => {
      active = false;
    };
  }, [mode]);
  return plan;
}
