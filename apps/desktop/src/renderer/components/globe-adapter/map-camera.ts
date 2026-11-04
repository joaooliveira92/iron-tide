import type { Map as MapLibreMap } from "maplibre-gl";

import { classifyHorizon, type GlobeCamera } from "../globe-spike/horizon.js";
import type { CameraProjection } from "./camera-contract.js";

export function cameraFromMap(map: MapLibreMap, projection: CameraProjection): GlobeCamera {
  const centre = map.getCenter();
  return {
    centre: [centre.lng, centre.lat],
    zoom: map.getZoom(),
    pitchDegrees: map.getPitch(),
    bearingDegrees: map.getBearing(),
    viewportHeightPx: map.getContainer().clientHeight,
    projection,
  } as GlobeCamera & { readonly projection: CameraProjection };
}

export function horizonFor(
  map: MapLibreMap,
  lon: number,
  lat: number,
  projection: CameraProjection,
) {
  if (projection === "mercator") return "front" as const;
  return classifyHorizon(cameraFromMap(map, projection), [lon, lat]);
}

export function mapHealth(map: MapLibreMap): boolean {
  try {
    return map.getCanvas() !== null;
  } catch {
    return false;
  }
}
