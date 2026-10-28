import type { FlatPolygon } from "../../lib/simplify-geometry.js";
import { campaignNationHue } from "../../content/presentationContent.js";
import { BORDERS_1880 } from "../world-map/borders-1880-data.js";
import type { LayerId, MapPrototypeState } from "../world-map/map-state.js";
import type { ProjectionId } from "../world-map/projection.js";
import type { CameraProjection } from "./camera-contract.js";
import type { OverlaySnapshot } from "./overlay-contract.js";

export interface AdapterLayerVisibility extends Readonly<Record<LayerId, boolean>> {
  readonly graticule: boolean;
}

export type AdapterFilter = readonly unknown[];

export function adapterLayerVisibility(
  layers: MapPrototypeState["layers"],
): AdapterLayerVisibility {
  return {
    ownership: layers.ownership,
    borders: layers.borders,
    lanes: layers.lanes,
    possessions: layers.possessions,
    fleets: layers.fleets,
    labels: layers.labels,
    routes: layers.routes,
    graticule: true,
  };
}

export function adapterProjectionFromApp(projection: ProjectionId): CameraProjection {
  return projection === "equirectangular" ? "mercator" : "globe";
}

export function appProjectionFromAdapter(projection: CameraProjection): ProjectionId {
  return projection === "mercator" ? "equirectangular" : "miller";
}

export function markerFilter(visibility: AdapterLayerVisibility): AdapterFilter {
  const clauses: AdapterFilter[] = [];
  if (visibility.possessions) clauses.push(["==", ["get", "markerClass"], "port"]);
  if (visibility.fleets) {
    clauses.push(["==", ["get", "markerClass"], "fleet"]);
    clauses.push(["==", ["get", "markerClass"], "alert"]);
  }
  if (clauses.length === 0) return ["==", ["get", "id"], "__none__"];
  return clauses.length === 1 ? (clauses[0] as AdapterFilter) : ["any", ...clauses];
}

export function overlayClassFilter(overlayClass: "lane" | "route"): AdapterFilter {
  return ["==", ["get", "overlayClass"], overlayClass];
}

export function ownershipColorExpression(
  overlay: Pick<OverlaySnapshot, "features"> | { ownership: ReadonlyMap<string, string | null> },
): string | AdapterFilter {
  if (!("ownership" in overlay)) return "#46647f";
  const entries = [...overlay.ownership]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap(([area, nation]) => [
      area,
      nation === null ? "#64748b" : `hsl(${campaignNationHue(nation)} 55% 42%)`,
    ]);
  if (entries.length === 0) return "#46647f";
  return ["match", ["get", "id"], ...entries, "#46647f"];
}

export function ownershipPaintValues(
  overlay: Parameters<typeof ownershipColorExpression>[0],
  visible: boolean,
): { readonly color: string | AdapterFilter; readonly opacity: number } {
  return {
    color: visible ? ownershipColorExpression(overlay) : "#33473b",
    opacity: visible ? 0.45 : 0.12,
  };
}

function closeRing(ring: readonly number[]): number[][] {
  const pairs: number[][] = [];
  for (let index = 0; index < ring.length; index += 2) {
    pairs.push([ring[index] as number, ring[index + 1] as number]);
  }
  const first = pairs[0];
  const last = pairs[pairs.length - 1];
  if (first !== undefined && last !== undefined && (first[0] !== last[0] || first[1] !== last[1])) {
    pairs.push([first[0] as number, first[1] as number]);
  }
  return pairs;
}

function borderPolygon(polygon: FlatPolygon): number[][][] {
  return polygon.map(closeRing).filter((ring) => ring.length >= 4);
}

export function buildBorderCollection(
  borders: Readonly<Record<string, readonly FlatPolygon[]>> = BORDERS_1880,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = Object.entries(borders)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .flatMap(([nation, polygons]) => {
      const coordinates = polygons.map(borderPolygon).filter((polygon) => polygon.length > 0);
      if (coordinates.length === 0) return [];
      return [
        {
          type: "Feature" as const,
          id: nation,
          properties: { id: nation, name: nation },
          geometry: { type: "MultiPolygon" as const, coordinates },
        },
      ];
    });
  return { type: "FeatureCollection", features };
}

export function borderColorExpression(
  borders: Readonly<Record<string, readonly FlatPolygon[]>> = BORDERS_1880,
): AdapterFilter {
  const entries = Object.keys(borders)
    .sort()
    .flatMap((nation) => [nation, `hsl(${campaignNationHue(nation)} 60% 62%)`]);
  return ["match", ["get", "id"], ...entries, "#93a9b8"];
}

export function buildGraticuleCollection(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const coordinates: number[][] = [];
    for (let lon = -180; lon <= 180; lon += 10) coordinates.push([lon, lat]);
    features.push({
      type: "Feature",
      properties: { kind: "parallel", value: lat },
      geometry: { type: "LineString", coordinates },
    });
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const coordinates: number[][] = [];
    for (let lat = -85; lat <= 85; lat += 5) coordinates.push([lon, lat]);
    features.push({
      type: "Feature",
      properties: { kind: "meridian", value: lon },
      geometry: { type: "LineString", coordinates },
    });
  }
  return { type: "FeatureCollection", features };
}

export interface GlobeViewport {
  readonly centre: readonly [number, number];
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
}

export function minimapViewportRect(
  viewport: GlobeViewport,
  width: number,
  height: number,
): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const span = Math.max(8, Math.min(360, 360 / 2 ** Math.max(0, viewport.zoom - 1)));
  const spanHeight = Math.max(4, Math.min(180, span / 2));
  const centreX = ((((viewport.centre[0] + 180) % 360) + 360) % 360) / 360;
  const centreY = (90 - viewport.centre[1]) / 180;
  const rectWidth = (span / 360) * width;
  const rectHeight = (spanHeight / 180) * height;
  return {
    x: centreX * width - rectWidth / 2,
    y: centreY * height - rectHeight / 2,
    width: rectWidth,
    height: rectHeight,
  };
}

export function minimapToLongitude(x: number, width: number): number {
  if (width <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, x / width));
  return Math.round((ratio * 360 - 180) / 10) * 10;
}

export function minimapToLatitude(y: number, height: number): number {
  if (height <= 0) return 0;
  const ratio = Math.max(0, Math.min(1, y / height));
  return Math.round((90 - ratio * 180) / 5) * 5;
}

export function scaleBarForZoom(
  zoom: number,
  maxPixels: number,
): { readonly pixels: number; readonly nauticalMiles: number } {
  const pixelsPerNauticalMile = (512 * 2 ** Math.max(0, zoom)) / (360 * 60);
  const candidates = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  let chosen = candidates[0] as number;
  for (const candidate of candidates) {
    if (candidate * pixelsPerNauticalMile <= maxPixels) chosen = candidate;
  }
  return { pixels: Math.max(1, chosen * pixelsPerNauticalMile), nauticalMiles: chosen };
}
