import type { SourceSpecification, LayerSpecification } from "maplibre-gl";

import { useLandPlan } from "../globe-spike/use-land-plan.js";
import { tileUrlTemplate } from "../globe-spike/baked-tiles.js";
import {
  buildBorderCollection,
  buildFrontierCollection,
  buildGraticuleCollection,
  nationMarkerColor,
  ownershipPaintValues,
} from "./adapter-layer-state.js";
import type { OverlayFeature, OverlaySnapshot } from "./overlay-contract.js";
import { type GlobeAdapterProps } from "./globe-adapter-types.js";

const EMPTY_COLLECTION = {
  type: "FeatureCollection" as const,
  features: [] as GeoJSON.Feature[],
};

export function baseDirectory(): string {
  const href = document.baseURI;
  return href.slice(0, href.lastIndexOf("/") + 1);
}

export function featureCollection(features: readonly OverlayFeature[]): GeoJSON.FeatureCollection {
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

export function ownershipPaint(overlay: GlobeAdapterProps["overlay"]): LayerSpecification["paint"] {
  const paint = ownershipPaintValues({ ownership: overlay.ownership }, true);
  return {
    "fill-color": paint.color,
    "fill-opacity": paint.opacity,
  } as LayerSpecification["paint"];
}

export function mapSources(
  plan: Extract<ReturnType<typeof useLandPlan>, { readonly kind: "baked" }>,
): Record<string, SourceSpecification> {
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
