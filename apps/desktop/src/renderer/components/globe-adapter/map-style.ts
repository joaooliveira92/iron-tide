import type { SourceSpecification, StyleSpecification } from "maplibre-gl";

import { tileUrlTemplate } from "../globe-spike/baked-tiles.js";
import {
  buildBorderCollection,
  buildFrontierCollection,
  buildGraticuleCollection,
  nationMarkerColor,
} from "./adapter-layer-state.js";
import { mapLayers, type BakedLandPlan, type MapLayerInputs } from "./map-layers.js";
import type { OverlayFeature, OverlaySnapshot } from "./overlay-contract.js";

export const GLOBE_ASSET_ROOT = "map-assets";

const EMPTY_COLLECTION = {
  type: "FeatureCollection" as const,
  features: [] as GeoJSON.Feature[],
};

function baseDirectory(): string {
  const href = document.baseURI;
  return href.slice(0, href.lastIndexOf("/") + 1);
}

function featureCollection(features: readonly OverlayFeature[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((feature) => ({
      type: "Feature",
      id: feature.id,
      properties: {
        id: feature.id,
        name: feature.label ?? feature.id,
        kind: feature.kind,
        markerClass: feature.markerClass ?? "",
        routeClass: feature.routeClass ?? "",
        overlayClass: feature.overlayClass ?? "",
        areaId: feature.areaId ?? "",
        nationId: feature.nationId ?? "",
        color: nationMarkerColor(feature.nationId),
        lon: feature.geometry.type === "Point" ? feature.geometry.lon : 0,
        lat: feature.geometry.type === "Point" ? feature.geometry.lat : 0,
      },
      geometry:
        feature.geometry.type === "Point"
          ? { type: "Point", coordinates: [feature.geometry.lon, feature.geometry.lat] }
          : {
              type: "LineString",
              coordinates: feature.geometry.coordinates.map((point) => [...point]),
            },
    })),
  };
}

export function markerCollection(snapshot: OverlaySnapshot): GeoJSON.FeatureCollection {
  return featureCollection(snapshot.features.filter((feature) => feature.kind === "marker"));
}

export function routeCollection(snapshot: OverlaySnapshot): GeoJSON.FeatureCollection {
  return featureCollection(snapshot.features.filter((feature) => feature.kind === "route"));
}

function mapSources(plan: BakedLandPlan): Record<string, SourceSpecification> {
  const { manifest } = plan.tiles;
  return {
    land: {
      type: "vector",
      tiles: [tileUrlTemplate()],
      minzoom: manifest.zoom.tileMin,
      maxzoom: manifest.zoom.tileMax,
      bounds: [...manifest.bounds],
      scheme: "xyz",
    },
    "adapter-markers": {
      type: "geojson",
      data: EMPTY_COLLECTION,
      promoteId: "id",
      maxzoom: 22,
      tolerance: 0,
    },
    "adapter-routes": {
      type: "geojson",
      data: EMPTY_COLLECTION,
      promoteId: "id",
      maxzoom: 22,
      tolerance: 0,
    },
    "adapter-borders": {
      type: "geojson",
      data: buildBorderCollection(),
      promoteId: "id",
      maxzoom: 22,
    },
    "adapter-border-lines": {
      type: "geojson",
      data: buildFrontierCollection(),
      promoteId: "id",
      maxzoom: 22,
    },
    "adapter-graticule": {
      type: "geojson",
      data: buildGraticuleCollection(),
      maxzoom: 22,
    },
  };
}

export function buildStyle(plan: BakedLandPlan, inputs: MapLayerInputs): StyleSpecification {
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
    layers: mapLayers(plan, inputs),
  };
}
