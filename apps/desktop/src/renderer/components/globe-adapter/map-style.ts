import type { StyleSpecification } from "maplibre-gl";

import { useLandPlan } from "../globe-spike/use-land-plan.js";
import { GLOBE_ASSET_ROOT, type GlobeAdapterProps } from "./globe-adapter-types.js";
import { mapLayers } from "./map-layers.js";
import { baseDirectory, mapSources } from "./map-sources.js";

export function buildStyle(
  plan: Extract<ReturnType<typeof useLandPlan>, { readonly kind: "baked" }>,
  overlay: GlobeAdapterProps["overlay"],
  layers: GlobeAdapterProps["state"]["layers"],
  showAreas: boolean,
): StyleSpecification {
  return {
    version: 8,
    glyphs: `${baseDirectory()}${GLOBE_ASSET_ROOT}/glyphs/{fontstack}/{range}.pbf`,
    projection: { type: "globe" },
    sky: {
      "sky-color": "#bff3fb",
      "horizon-color": "#eafcff",
      "fog-color": "#eafcff",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.3,
      "fog-ground-blend": 0,
      "atmosphere-blend": 1,
    },
    sources: mapSources(plan),
    layers: mapLayers(plan, overlay, layers, showAreas),
  };
}
