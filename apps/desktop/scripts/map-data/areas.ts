import { MapDataError } from "./errors.ts";
import { canonicalJson } from "./config.ts";
import { MAX_MERCATOR_LATITUDE, type Position } from "./geodesy.ts";
import { densifyRing } from "../../src/renderer/components/globe-spike/densify.ts";

export interface AreaSource {
  readonly id: string;
  readonly name: string;
  readonly ring: readonly Position[];
}

export interface AreaOutlineSpec {
  readonly schemaVersion: 1;
  readonly datasetVersion: string;
  readonly edgeSemantics: "lonlat-linear";
  readonly densifyToleranceMetres: number;
  readonly source: {
    readonly module: string;
    readonly export: string;
    readonly count: number;
    readonly canonicalSha256: string;
  };
}

export interface PreparedArea {
  readonly ordinal: number;
  readonly id: string;
  readonly name: string;
  readonly sourceRing: readonly Position[];
  readonly ring: readonly Position[];
  readonly orientation: "clockwise" | "counter-clockwise";
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MapDataError(`area outlines: ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function textAt(source: Record<string, unknown>, key: string, label: string): string {
  const found = source[key];
  if (typeof found !== "string" || found.length === 0) {
    throw new MapDataError(`area outlines: ${label}.${key} must be a non-empty string`);
  }
  return found;
}

export function decodeAreaSpec(value: unknown): AreaOutlineSpec {
  const spec = record(value, "spec");
  if (spec.schemaVersion !== 1) {
    throw new MapDataError("area outlines: unsupported schemaVersion");
  }
  if (spec.edgeSemantics === undefined) {
    throw new MapDataError("area outlines: edgeSemantics must be declared explicitly");
  }
  if (spec.edgeSemantics !== "lonlat-linear") {
    throw new MapDataError(
      `area outlines: edgeSemantics ${JSON.stringify(spec.edgeSemantics)} is not accepted; only 'lonlat-linear' is`,
    );
  }
  const tolerance = spec.densifyToleranceMetres;
  if (typeof tolerance !== "number" || !Number.isFinite(tolerance) || tolerance <= 0) {
    throw new MapDataError("area outlines: densifyToleranceMetres must be a positive number");
  }
  const source = record(spec.source, "source");
  if (typeof source.count !== "number" || !Number.isInteger(source.count) || source.count <= 0) {
    throw new MapDataError("area outlines: source.count must be a positive integer");
  }
  return {
    schemaVersion: 1,
    datasetVersion: textAt(spec, "datasetVersion", "spec"),
    edgeSemantics: "lonlat-linear",
    densifyToleranceMetres: tolerance,
    source: {
      module: textAt(source, "module", "source"),
      export: textAt(source, "export", "source"),
      count: source.count,
      canonicalSha256: textAt(source, "canonicalSha256", "source"),
    },
  };
}

export function closeRing(ring: readonly Position[]): readonly Position[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first === undefined || last === undefined) return ring;
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}

export function signedArea(ring: readonly Position[]): number {
  let sum = 0;
  for (let index = 0; index + 1 < ring.length; index++) {
    const a = ring[index] as Position;
    const b = ring[index + 1] as Position;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

export function canonicalAreaHash(
  areas: readonly AreaSource[],
  sha256: (text: string) => string,
): string {
  return sha256(
    canonicalJson(
      [...areas]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((area) => ({ id: area.id, ring: closeRing(area.ring).map((point) => [...point]) })),
    ),
  );
}

export function validateAreaSource(
  areas: readonly AreaSource[],
  spec: AreaOutlineSpec,
  sha256: (text: string) => string,
): void {
  if (areas.length !== spec.source.count) {
    throw new MapDataError(
      `area outlines: ${areas.length} areas found, the spec declares ${spec.source.count}`,
    );
  }
  const seen = new Set<string>();
  for (const area of areas) {
    if (seen.has(area.id)) throw new MapDataError(`area outlines: duplicate id '${area.id}'`);
    seen.add(area.id);
    const ring = closeRing(area.ring);
    if (ring.length < 4)
      throw new MapDataError(`area outlines: '${area.id}' has fewer than 3 vertices`);
    for (const point of ring) {
      if (
        !Number.isFinite(point[0]) ||
        !Number.isFinite(point[1]) ||
        Math.abs(point[1]) > MAX_MERCATOR_LATITUDE ||
        point[0] < -360 ||
        point[0] > 540
      ) {
        throw new MapDataError(
          `area outlines: '${area.id}' has a vertex outside the accepted range`,
        );
      }
    }
    for (let index = 0; index + 1 < ring.length; index++) {
      const a = ring[index] as Position;
      const b = ring[index + 1] as Position;
      if (a[0] === b[0] && a[1] === b[1]) {
        throw new MapDataError(`area outlines: '${area.id}' has a zero-length edge`);
      }
      if (Math.abs(b[0] - a[0]) >= 180) {
        throw new MapDataError(
          `area outlines: '${area.id}' has an edge spanning 180 degrees or more of longitude; its lon/lat-linear interpretation would be ambiguous`,
        );
      }
    }
    if (signedArea(ring) === 0) {
      throw new MapDataError(`area outlines: '${area.id}' encloses no area`);
    }
  }
  const actual = canonicalAreaHash(areas, sha256);
  if (actual !== spec.source.canonicalSha256) {
    throw new MapDataError(
      `area outlines: source geometry hash ${actual} does not match the pinned ${spec.source.canonicalSha256}`,
    );
  }
}

export function prepareAreas(
  areas: readonly AreaSource[],
  spec: AreaOutlineSpec,
): readonly PreparedArea[] {
  return [...areas]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((area, index) => {
      const closed = closeRing(area.ring);
      const dense = densifyRing(closed, spec.densifyToleranceMetres);
      const ring = dedupeConsecutive(dense);
      return {
        ordinal: index + 1,
        id: area.id,
        name: area.name,
        sourceRing: closed,
        ring: closeRing(ring),
        orientation: signedArea(closed) > 0 ? "counter-clockwise" : "clockwise",
      };
    });
}

function dedupeConsecutive(ring: readonly Position[]): readonly Position[] {
  const out: Position[] = [];
  for (const point of ring) {
    const previous = out[out.length - 1];
    if (previous !== undefined && previous[0] === point[0] && previous[1] === point[1]) continue;
    out.push(point);
  }
  return out;
}

export function areaFillFeatures(areas: readonly PreparedArea[]): GeoJSON.Feature[] {
  return areas.map((area) => ({
    type: "Feature",
    id: area.ordinal,
    properties: { id: area.id, name: area.name },
    geometry: { type: "Polygon", coordinates: [area.ring.map((point) => [point[0], point[1]])] },
  }));
}

export function areaOutlineFeatures(areas: readonly PreparedArea[]): GeoJSON.Feature[] {
  return areas.map((area) => ({
    type: "Feature",
    id: area.ordinal,
    properties: { id: area.id, name: area.name },
    geometry: { type: "LineString", coordinates: area.ring.map((point) => [point[0], point[1]]) },
  }));
}
