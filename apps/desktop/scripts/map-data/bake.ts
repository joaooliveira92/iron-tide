import geojsonvt from "geojson-vt";
import vtpbf from "vt-pbf";

import type { ProtectedCatalogue, ProtectedFeature } from "./catalogue.ts";
import { MapDataError } from "./errors.ts";
import {
  clampToMercator,
  densifyRingLonLat,
  distanceToSegmentMetres,
  interpolateLonLat,
  metresBetween,
  type Position,
} from "./geodesy.ts";
import { areaFillFeatures, areaOutlineFeatures, type PreparedArea } from "./areas.ts";
import { canonicalJson, type PipelineConfig } from "./config.ts";
import {
  indexPolygons,
  landTestFromPolygons,
  measureTransect,
  type TransectMeasurement,
} from "./passage.ts";
import { ringExtentWorld, simplifyRing } from "./simplify.ts";
import {
  TilePack,
  encodeTilePack,
  type TilePackTile,
} from "../../src/renderer/components/globe-spike/tilepack.ts";

export interface NamedLine {
  readonly name: string;
  readonly parts: readonly (readonly Position[])[];
}

export interface GeometryInput {
  readonly landPolygons: readonly (readonly (readonly Position[])[])[];
  readonly riverLines: readonly NamedLine[];
  readonly areas: readonly PreparedArea[];
}

export interface ResolvedOverlay {
  readonly featureId: string;
  readonly kind: "canal" | "strait";
  readonly requiredFromZoom: number;
  readonly renderedWidthPixels: number;
  readonly lines: readonly (readonly Position[])[];
  readonly reason: "overlay-line" | "sealed-strait-fallback";
}

export interface ResolvedPassage {
  readonly featureId: string;
  readonly transectId: string;
  readonly from: Position;
  readonly to: Position;
  readonly source: TransectMeasurement;
  readonly sealed: boolean;
}

export interface Resolution {
  readonly overlays: readonly ResolvedOverlay[];
  readonly passages: readonly ResolvedPassage[];
  readonly pinZones: readonly PinZone[];
}

export interface PinZone {
  readonly featureId: string;
  readonly a: Position;
  readonly b: Position;
  readonly radiusMetres: number;
}

export interface LevelStats {
  readonly zoom: number;
  readonly tiles: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly landVertices: number;
  readonly landRings: number;
  readonly pinnedVertices: number;
  readonly areaTiles: number;
  readonly areaVertices: number;
  readonly simplificationToleranceMetres: number;
  readonly quantisationMetres: number;
}

export interface BakeOutput {
  readonly pack: Uint8Array;
  readonly levels: readonly LevelStats[];
  readonly resolution: Resolution;
  readonly sourceVertices: number;
  readonly densifiedVertices: number;
}

const AREA_SOURCE_PRECISION_ZOOMS = 3;
const WATER_STEP_METRES = 100;
const SEAL_FRACTION = 0.5;

function lineByName(lines: readonly NamedLine[], name: string): readonly (readonly Position[])[] {
  const parts: (readonly Position[])[] = [];
  for (const line of lines) if (line.name === name) parts.push(...line.parts);
  return parts;
}

export function resolveProtection(
  catalogue: ProtectedCatalogue,
  input: GeometryInput,
  config: PipelineConfig,
): Resolution {
  const isLand = landTestFromPolygons(indexPolygons(input.landPolygons));
  const overlays: ResolvedOverlay[] = [];
  const passages: ResolvedPassage[] = [];
  const pinZones: PinZone[] = [];
  for (const feature of catalogue.features) {
    if (feature.representation === "overlay-line") {
      const geometry = feature.geometry;
      if (geometry === undefined) throw new MapDataError(`${feature.id}: missing geometry`);
      const lines =
        geometry.source === "authored"
          ? geometry.lines.map((line) => line.map((point): Position => [point[0], point[1]]))
          : lineByName(input.riverLines, geometry.name);
      if (lines.length === 0) {
        throw new MapDataError(
          `${feature.id}: no source geometry named '${geometry.source === "natural-earth" ? geometry.name : ""}'`,
        );
      }
      overlays.push({
        featureId: feature.id,
        kind: feature.type,
        requiredFromZoom: feature.requiredFromZoom,
        renderedWidthPixels: feature.renderedWidthPixels ?? config.overlayRenderedWidthPixels,
        lines,
        reason: "overlay-line",
      });
      continue;
    }
    let anyOpen = false;
    for (const transect of feature.transects ?? []) {
      const from: Position = [transect.from[0], transect.from[1]];
      const to: Position = [transect.to[0], transect.to[1]];
      const measurement = measureTransect(isLand, from, to, WATER_STEP_METRES);
      const reference = feature.referenceWidthMetres ?? 0;
      const sealed = measurement.longestWaterMetres < reference * SEAL_FRACTION;
      if (!sealed) anyOpen = true;
      passages.push({
        featureId: feature.id,
        transectId: transect.id,
        from,
        to,
        source: measurement,
        sealed,
      });
      if (measurement.longest !== null && !sealed) {
        const total = measurement.lengthMetres;
        const a = interpolateLonLat(from, to, measurement.longest.startMetres / total);
        const b = interpolateLonLat(from, to, measurement.longest.endMetres / total);
        pinZones.push({
          featureId: feature.id,
          a,
          b,
          radiusMetres: Math.max(3000, 0.5 * measurement.longestWaterMetres),
        });
      }
    }
    if (!anyOpen) {
      const fallback = feature.fallbackOverlay;
      if (fallback === undefined) {
        throw new MapDataError(
          `${feature.id}: base data seals the passage and no fallback overlay exists`,
        );
      }
      overlays.push({
        featureId: feature.id,
        kind: "strait",
        requiredFromZoom: feature.requiredFromZoom,
        renderedWidthPixels: feature.renderedWidthPixels ?? config.overlayRenderedWidthPixels,
        lines: fallback.lines.map((line) => line.map((point): Position => [point[0], point[1]])),
        reason: "sealed-strait-fallback",
      });
    }
  }
  return { overlays, passages, pinZones };
}

function isPinned(point: Position, zones: readonly PinZone[]): boolean {
  for (const zone of zones) {
    if (distanceToSegmentMetres(point, zone.a, zone.b) <= zone.radiusMetres) return true;
  }
  return false;
}

interface PreparedRing {
  readonly points: readonly Position[];
  readonly pinned: readonly boolean[];
}

function prepareRings(
  polygons: readonly (readonly (readonly Position[])[])[],
  zones: readonly PinZone[],
  toleranceMetres: number,
): { readonly polygons: readonly (readonly PreparedRing[])[]; readonly densified: number } {
  let densified = 0;
  const prepared = polygons.map((rings) =>
    rings.map((ring): PreparedRing => {
      const clamped = ring.map(clampToMercator);
      const points = densifyRingLonLat(clamped, toleranceMetres);
      densified += points.length;
      return { points, pinned: points.map((point) => isPinned(point, zones)) };
    }),
  );
  return { polygons: prepared, densified };
}

function levelFeatures(
  prepared: readonly (readonly PreparedRing[])[],
  zoom: number,
  config: PipelineConfig,
): {
  readonly features: GeoJSON.Feature[];
  readonly vertices: number;
  readonly rings: number;
  readonly pinned: number;
} {
  const pixelWorld = 1 / (512 * 2 ** zoom);
  const tolerance = config.simplificationPixels * pixelWorld;
  const features: GeoJSON.Feature[] = [];
  let vertices = 0;
  let rings = 0;
  let pinnedCount = 0;
  for (const polygon of prepared) {
    const outer = polygon[0];
    if (outer === undefined) continue;
    const hasPinned = outer.pinned.some(Boolean);
    if (!hasPinned && ringExtentWorld(outer.points) < pixelWorld) continue;
    const coordinates: [number, number][][] = [];
    polygon.forEach((ring, index) => {
      const simplified = simplifyRing(ring.points, ring.pinned, tolerance);
      if (simplified.length < 4) {
        if (index === 0) coordinates.length = 0;
        return;
      }
      if (index > 0 && ringExtentWorld(simplified) < pixelWorld && !ring.pinned.some(Boolean))
        return;
      coordinates.push(simplified.map((point): [number, number] => [point[0], point[1]]));
      vertices += simplified.length;
      rings += 1;
      pinnedCount += ring.pinned.filter(Boolean).length;
    });
    if (coordinates.length === 0) continue;
    features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } });
  }
  return { features, vertices, rings, pinned: pinnedCount };
}

function overlayFeatures(
  overlays: readonly ResolvedOverlay[],
  zoom: number,
  toleranceMetres: number,
): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];
  for (const overlay of overlays) {
    if (zoom < overlay.requiredFromZoom) continue;
    for (const line of overlay.lines) {
      features.push({
        type: "Feature",
        properties: {
          id: overlay.featureId,
          kind: overlay.kind,
          width: overlay.renderedWidthPixels,
        },
        geometry: {
          type: "LineString",
          coordinates: densifyRingLonLat(line.map(clampToMercator), toleranceMetres).map(
            (point) => [...point],
          ),
        },
      });
    }
  }
  return features;
}

function toBytes(value: ArrayBufferView): Uint8Array {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
}

export interface BakeOptions {
  readonly pinning: boolean;
}

export function bakeTiles(
  catalogue: ProtectedCatalogue,
  input: GeometryInput,
  config: PipelineConfig,
  sha256: (bytes: Uint8Array) => string,
  options: BakeOptions = { pinning: true },
): BakeOutput {
  const resolution = resolveProtection(catalogue, input, config);
  const activeZones = options.pinning ? resolution.pinZones : [];
  const { polygons, densified } = prepareRings(
    input.landPolygons,
    activeZones,
    config.densifyToleranceMetres,
  );
  const tiles: TilePackTile[] = [];
  const levels: LevelStats[] = [];
  const areaTilingOptions = {
    maxZoom: config.tileMaxZoom + AREA_SOURCE_PRECISION_ZOOMS,
    indexMaxZoom: config.tileMaxZoom,
    tolerance: 0,
    extent: config.tileExtent,
    buffer: config.tileBuffer,
    debug: 0 as const,
  };
  const areaFillIndex = new geojsonvt(
    { type: "FeatureCollection", features: areaFillFeatures(input.areas) },
    areaTilingOptions,
  );
  const areaOutlineIndex = new geojsonvt(
    { type: "FeatureCollection", features: areaOutlineFeatures(input.areas) },
    areaTilingOptions,
  );
  const areaVertices = input.areas.reduce((sum, area) => sum + area.ring.length, 0);
  for (let zoom = config.tileMinZoom; zoom <= config.tileMaxZoom; zoom++) {
    const land = levelFeatures(polygons, zoom, config);
    const overlay = overlayFeatures(resolution.overlays, zoom, config.densifyToleranceMetres);
    const tilingOptions = {
      maxZoom: zoom,
      indexMaxZoom: zoom,
      tolerance: 0,
      extent: config.tileExtent,
      buffer: config.tileBuffer,
      debug: 0 as const,
    };
    const landIndex = new geojsonvt(
      { type: "FeatureCollection", features: land.features },
      tilingOptions,
    );
    const overlayIndex = new geojsonvt(
      { type: "FeatureCollection", features: overlay },
      tilingOptions,
    );
    const levelTiles: TilePackTile[] = [];
    let areaTiles = 0;
    const span = 2 ** zoom;
    for (let x = 0; x < span; x++) {
      for (let y = 0; y < span; y++) {
        const landTile = landIndex.getTile(zoom, x, y);
        const overlayTile = overlayIndex.getTile(zoom, x, y);
        const layers: Record<string, unknown> = {};
        if (landTile !== null) layers[config.layers.land] = landTile;
        if (overlayTile !== null) layers[config.layers.protected] = overlayTile;
        const fillTile = areaFillIndex.getTile(zoom, x, y);
        const outlineTile = areaOutlineIndex.getTile(zoom, x, y);
        if (fillTile !== null) layers[config.layers.areas] = fillTile;
        if (outlineTile !== null) layers[config.layers.areaOutlines] = outlineTile;
        if (fillTile !== null || outlineTile !== null) areaTiles += 1;
        if (Object.keys(layers).length === 0) continue;
        const data = toBytes(
          vtpbf.fromGeojsonVt(layers as Parameters<typeof vtpbf.fromGeojsonVt>[0], {
            version: 2,
            extent: config.tileExtent,
          }),
        );
        levelTiles.push({ z: zoom, x, y, data });
      }
    }
    const levelBytes = levelTiles.reduce((sum, tile) => sum + tile.data.length, 0);
    const joined = new Uint8Array(levelBytes);
    let cursor = 0;
    for (const tile of levelTiles) {
      joined.set(tile.data, cursor);
      cursor += tile.data.length;
    }
    const metresPerPixel = (2 * Math.PI * 6371008.8) / (512 * 2 ** zoom);
    levels.push({
      zoom,
      tiles: levelTiles.length,
      bytes: levelBytes,
      sha256: sha256(joined),
      landVertices: land.vertices,
      landRings: land.rings,
      pinnedVertices: land.pinned,
      areaTiles,
      areaVertices,
      simplificationToleranceMetres: Number(
        (config.simplificationPixels * metresPerPixel).toFixed(1),
      ),
      quantisationMetres: Number(((metresPerPixel * 512) / config.tileExtent).toFixed(2)),
    });
    tiles.push(...levelTiles);
  }
  const pack = encodeTilePack(tiles);
  TilePack.parse(pack);
  const sourceVertices = input.landPolygons.reduce(
    (sum, rings) => sum + rings.reduce((inner, ring) => inner + ring.length, 0),
    0,
  );
  return { pack, levels, resolution, sourceVertices, densifiedVertices: densified };
}

export function configurationHash(
  config: PipelineConfig,
  catalogue: ProtectedCatalogue,
  pins: unknown,
  sha256: (bytes: string) => string,
  areas: unknown,
): string {
  return sha256(canonicalJson({ config, catalogue, pins, areas }));
}

export function featureOf(catalogue: ProtectedCatalogue, id: string): ProtectedFeature {
  const feature = catalogue.features.find((entry) => entry.id === id);
  if (feature === undefined) throw new MapDataError(`unknown protected feature '${id}'`);
  return feature;
}

export function metresBetweenPositions(a: Position, b: Position): number {
  return metresBetween(a, b);
}
