import type { PreparedArea } from "./areas.ts";
import type { PipelineConfig } from "./config.ts";
import { metresPerPixelAtZoom, wrapLongitude, type Position } from "./geodesy.ts";
import { decodeTile, lonLatToTileLocal, type DecodedTile } from "./mvt.ts";
import {
  TileLandSampler,
  validateTileEdges,
  type Finding,
  type TileEdgeSummary,
} from "./validate.ts";
import type { TilePack } from "../../src/renderer/components/globe-spike/tilepack.ts";

type Local = readonly [number, number];

export interface AreaLevelSummary {
  readonly zoom: number;
  readonly tilesWithAreas: number;
  readonly fillPieces: number;
  readonly outlinePieces: number;
  readonly labelPieces: number;
  readonly idsInFill: number;
  readonly idsInOutline: number;
  readonly idsInLabels: number;
}

export interface AreaValidation {
  readonly passed: boolean;
  readonly checks: number;
  readonly findings: readonly Finding[];
  readonly levels: readonly AreaLevelSummary[];
  readonly fidelity: {
    readonly level: number;
    readonly vertices: number;
    readonly worstUnits: number;
    readonly boundUnits: number;
  };
  readonly cracks: {
    readonly level: number;
    readonly pairs: number;
    readonly samples: number;
    readonly worstUnits: number;
    readonly worstMetres: number;
    readonly boundUnits: number;
  };
  readonly labels: {
    readonly level: number;
    readonly expected: number;
    readonly found: number;
    readonly worstUnits: number;
    readonly boundUnits: number;
  };
  readonly fillEdges: readonly TileEdgeSummary[];
  readonly outlineEdges: readonly {
    readonly level: number;
    readonly crossings: number;
    readonly mismatches: number;
    readonly worstGapUnits: number;
  }[];
  readonly vertexCounts: { readonly source: number; readonly densified: number };
}

const FIDELITY_BOUND_UNITS = 1;
const CRACK_BOUND_UNITS = 1.5;
const EDGE_MATCH_UNITS = 1.5;
const COLLINEAR_EPSILON = 1e-9;

class Tiles {
  private readonly cache = new Map<string, DecodedTile | null>();
  private readonly pack: TilePack;

  constructor(pack: TilePack) {
    this.pack = pack;
  }

  get(z: number, x: number, y: number): DecodedTile | null {
    const key = `${z}/${x}/${y}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const bytes = this.pack.get(z, x, y);
    const decoded = bytes === null ? null : decodeTile(bytes);
    this.cache.set(key, decoded);
    return decoded;
  }
}

function pieces(tile: DecodedTile | null, layer: string, id: string): (readonly Local[])[] {
  if (tile === null) return [];
  const out: (readonly Local[])[] = [];
  for (const feature of tile.layers.get(layer) ?? []) {
    if (feature.properties.id !== id) continue;
    for (const ring of feature.rings) out.push(ring);
  }
  return out;
}

function nearestOnSegment(point: Local, a: Local, b: Local): { point: Local; distance: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
  const nearest: Local = [a[0] + dx * t, a[1] + dy * t];
  return { point: nearest, distance: Math.hypot(point[0] - nearest[0], point[1] - nearest[1]) };
}

function nearest(
  lines: readonly (readonly Local[])[],
  point: Local,
): { point: Local; distance: number } | null {
  let best: { point: Local; distance: number } | null = null;
  for (const line of lines) {
    for (let index = 0; index + 1 < line.length; index++) {
      const candidate = nearestOnSegment(point, line[index] as Local, line[index + 1] as Local);
      if (best === null || candidate.distance < best.distance) best = candidate;
    }
  }
  return best;
}

function locate(zoom: number, position: Position, extent: number) {
  return lonLatToTileLocal(zoom, [wrapLongitude(position[0]), position[1]], extent);
}

function unitMetres(zoom: number, latitude: number, extent: number): number {
  return (metresPerPixelAtZoom(zoom, latitude) * 512) / extent;
}

function shoelace(ring: readonly Local[]): number {
  let sum = 0;
  for (let index = 0; index + 1 < ring.length; index++) {
    const a = ring[index] as Local;
    const b = ring[index + 1] as Local;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

interface SourceEdge {
  readonly area: string;
  readonly from: Position;
  readonly to: Position;
}

function cross(a: Position, b: Position, c: Position): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function overlapSpan(a: SourceEdge, b: SourceEdge): readonly [number, number, 0 | 1] | null {
  if (
    Math.abs(cross(a.from, a.to, b.from)) > COLLINEAR_EPSILON ||
    Math.abs(cross(a.from, a.to, b.to)) > COLLINEAR_EPSILON
  ) {
    return null;
  }
  const axis: 0 | 1 = Math.abs(a.to[0] - a.from[0]) >= Math.abs(a.to[1] - a.from[1]) ? 0 : 1;
  const low = Math.max(Math.min(a.from[axis], a.to[axis]), Math.min(b.from[axis], b.to[axis]));
  const high = Math.min(Math.max(a.from[axis], a.to[axis]), Math.max(b.from[axis], b.to[axis]));
  return high - low > COLLINEAR_EPSILON ? [low, high, axis] : null;
}

export function sharedBoundaries(areas: readonly PreparedArea[]): {
  readonly a: SourceEdge;
  readonly b: SourceEdge;
  readonly span: readonly [number, number, 0 | 1];
}[] {
  const edges: SourceEdge[] = areas.flatMap((area) => {
    const out: SourceEdge[] = [];
    for (let index = 0; index + 1 < area.sourceRing.length; index++) {
      out.push({
        area: area.id,
        from: area.sourceRing[index] as Position,
        to: area.sourceRing[index + 1] as Position,
      });
    }
    return out;
  });
  const pairs: { a: SourceEdge; b: SourceEdge; span: readonly [number, number, 0 | 1] }[] = [];
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i] as SourceEdge;
      const b = edges[j] as SourceEdge;
      if (a.area === b.area) continue;
      const span = overlapSpan(a, b);
      if (span !== null) pairs.push({ a, b, span });
    }
  }
  return pairs;
}

function validateLevels(
  pack: TilePack,
  tiles: Tiles,
  areas: readonly PreparedArea[],
  config: PipelineConfig,
  findings: Finding[],
): AreaLevelSummary[] {
  const summaries: AreaLevelSummary[] = [];
  const expected = new Map(areas.map((area) => [area.id, area.ordinal]));
  for (let zoom = config.tileMinZoom; zoom <= config.tileMaxZoom; zoom++) {
    const fillIds = new Set<string>();
    const outlineIds = new Set<string>();
    const labelIds = new Set<string>();
    let tilesWithAreas = 0;
    let fillPieces = 0;
    let outlinePieces = 0;
    let labelPieces = 0;
    let badOrientation = 0;
    let openRings = 0;
    let badIds = 0;
    for (const entry of pack.entries()) {
      if (entry.z !== zoom) continue;
      const tile = tiles.get(entry.z, entry.x, entry.y);
      if (tile === null) continue;
      const fills = tile.layers.get(config.layers.areas) ?? [];
      const outlines = tile.layers.get(config.layers.areaOutlines) ?? [];
      if (fills.length + outlines.length > 0) tilesWithAreas += 1;
      for (const feature of fills) {
        const id = String(feature.properties.id);
        fillIds.add(id);
        fillPieces += 1;
        if (feature.id !== expected.get(id)) badIds += 1;
        for (const ring of feature.rings) {
          const first = ring[0] as Local;
          const last = ring[ring.length - 1] as Local;
          if (first[0] !== last[0] || first[1] !== last[1]) openRings += 1;
          if (shoelace(ring) <= 0) badOrientation += 1;
        }
      }
      for (const feature of outlines) {
        const id = String(feature.properties.id);
        outlineIds.add(id);
        outlinePieces += 1;
        if (feature.id !== expected.get(id)) badIds += 1;
      }
      for (const feature of tile.layers.get(config.layers.areaLabels) ?? []) {
        const id = String(feature.properties.id);
        labelIds.add(id);
        labelPieces += 1;
        if (feature.id !== expected.get(id)) badIds += 1;
      }
    }
    const missingFill = areas.filter((area) => !fillIds.has(area.id)).map((area) => area.id);
    const missingOutline = areas.filter((area) => !outlineIds.has(area.id)).map((area) => area.id);
    const missingLabels = areas.filter((area) => !labelIds.has(area.id)).map((area) => area.id);
    if (missingFill.length > 0) {
      findings.push({
        featureId: "areas",
        level: zoom,
        rule: "area-id-preserved",
        detail: `fill tiles lost ${missingFill.length} area(s): ${missingFill.slice(0, 3).join(", ")}`,
      });
    }
    if (missingOutline.length > 0) {
      findings.push({
        featureId: "area_outlines",
        level: zoom,
        rule: "area-id-preserved",
        detail: `outline tiles lost ${missingOutline.length} area(s): ${missingOutline.slice(0, 3).join(", ")}`,
      });
    }
    if (missingLabels.length > 0) {
      findings.push({
        featureId: "area_labels",
        level: zoom,
        rule: "area-label-id",
        detail: `label tiles lost ${missingLabels.length} area(s): ${missingLabels.slice(0, 3).join(", ")}`,
      });
    }
    if (badIds > 0) {
      findings.push({
        featureId: "areas",
        level: zoom,
        rule: "area-feature-id",
        detail: `${badIds} feature(s) carry a numeric id that is not the area's stable ordinal`,
      });
    }
    if (openRings > 0) {
      findings.push({
        featureId: "areas",
        level: zoom,
        rule: "ring-closure",
        detail: `${openRings} fill ring(s) are not closed`,
      });
    }
    if (badOrientation > 0) {
      findings.push({
        featureId: "areas",
        level: zoom,
        rule: "ring-orientation",
        detail: `${badOrientation} fill ring(s) are not exterior-oriented`,
      });
    }
    summaries.push({
      zoom,
      tilesWithAreas,
      fillPieces,
      outlinePieces,
      labelPieces,
      idsInFill: fillIds.size,
      idsInOutline: outlineIds.size,
      idsInLabels: labelIds.size,
    });
  }
  return summaries;
}

function validateFidelity(
  tiles: Tiles,
  areas: readonly PreparedArea[],
  config: PipelineConfig,
  findings: Finding[],
): AreaValidation["fidelity"] {
  const zoom = config.tileMaxZoom;
  let vertices = 0;
  let worst = 0;
  for (const area of areas) {
    let worstForArea = 0;
    let firstBad = "";
    for (const point of area.ring) {
      const { x, y, local } = locate(zoom, point, config.tileExtent);
      const found = nearest(
        pieces(tiles.get(zoom, x, y), config.layers.areaOutlines, area.id),
        local,
      );
      vertices += 1;
      const distance = found === null ? Number.POSITIVE_INFINITY : found.distance;
      if (distance > worstForArea) {
        worstForArea = distance;
        if (distance > FIDELITY_BOUND_UNITS && firstBad === "")
          firstBad = `${point[0]},${point[1]}`;
      }
    }
    worst = Math.max(worst, worstForArea);
    if (worstForArea > FIDELITY_BOUND_UNITS) {
      findings.push({
        featureId: area.id,
        level: zoom,
        rule: "outline-fidelity",
        detail: `a densified vertex (${firstBad}) is ${worstForArea.toFixed(2)} tile units from the baked outline; the quantisation bound is ${FIDELITY_BOUND_UNITS}`,
      });
    }
  }
  return {
    level: zoom,
    vertices,
    worstUnits: Number(worst.toFixed(3)),
    boundUnits: FIDELITY_BOUND_UNITS,
  };
}

function validateCracks(
  tiles: Tiles,
  areas: readonly PreparedArea[],
  config: PipelineConfig,
  findings: Finding[],
): AreaValidation["cracks"] {
  const zoom = config.tileMaxZoom;
  const pairs = sharedBoundaries(areas);
  const byId = new Map(areas.map((area) => [area.id, area]));
  let samples = 0;
  let worstUnits = 0;
  let worstMetres = 0;
  for (const { a, b, span } of pairs) {
    const [low, high, axis] = span;
    const candidates: Position[] = [];
    for (const id of [a.area, b.area]) {
      for (const point of (byId.get(id) as PreparedArea).ring) {
        const onA = Math.abs(cross(a.from, a.to, point)) < COLLINEAR_EPSILON;
        const inside =
          point[axis] >= low - COLLINEAR_EPSILON && point[axis] <= high + COLLINEAR_EPSILON;
        if (onA && inside) candidates.push(point);
      }
    }
    for (const point of candidates) {
      const { x, y, local } = locate(zoom, point, config.tileExtent);
      const tile = tiles.get(zoom, x, y);
      const onFirst = nearest(pieces(tile, config.layers.areaOutlines, a.area), local);
      const onSecond = nearest(pieces(tile, config.layers.areaOutlines, b.area), local);
      samples += 1;
      if (onFirst === null || onSecond === null) {
        worstUnits = Number.POSITIVE_INFINITY;
        findings.push({
          featureId: `${a.area}|${b.area}`,
          level: zoom,
          rule: "neighbour-crack",
          detail: `no baked outline near shared point ${point[0]},${point[1]}`,
        });
        continue;
      }
      const gap = Math.hypot(
        onFirst.point[0] - onSecond.point[0],
        onFirst.point[1] - onSecond.point[1],
      );
      if (gap > worstUnits) {
        worstUnits = gap;
        worstMetres = gap * unitMetres(zoom, point[1], config.tileExtent);
      }
      if (gap > CRACK_BOUND_UNITS) {
        findings.push({
          featureId: `${a.area}|${b.area}`,
          level: zoom,
          rule: "neighbour-crack",
          detail: `outlines are ${gap.toFixed(2)} tile units apart at ${point[0]},${point[1]}; the bound is ${CRACK_BOUND_UNITS}`,
        });
      }
    }
  }
  return {
    level: zoom,
    pairs: pairs.length,
    samples,
    worstUnits: Number(worstUnits.toFixed(3)),
    worstMetres: Number(worstMetres.toFixed(2)),
    boundUnits: CRACK_BOUND_UNITS,
  };
}

interface Crossing {
  readonly id: string;
  readonly point: Local;
}

function crossings(tile: DecodedTile | null, layer: string, axis: 0 | 1, at: number): Crossing[] {
  const out: Crossing[] = [];
  if (tile === null) return out;
  const other = axis === 0 ? 1 : 0;
  for (const feature of tile.layers.get(layer) ?? []) {
    for (const line of feature.rings) {
      for (let index = 0; index + 1 < line.length; index++) {
        const a = line[index] as Local;
        const b = line[index + 1] as Local;
        if (a[axis] === b[axis]) continue;
        if ((a[axis] - at) * (b[axis] - at) > 0) continue;
        const t = (at - a[axis]) / (b[axis] - a[axis]);
        const along = a[other] + (b[other] - a[other]) * t;
        out.push({
          id: String(feature.properties.id),
          point: axis === 0 ? [at, along] : [along, at],
        });
      }
    }
  }
  return out;
}

function validateOutlineEdges(
  pack: TilePack,
  tiles: Tiles,
  config: PipelineConfig,
  findings: Finding[],
): AreaValidation["outlineEdges"] {
  const summaries: {
    level: number;
    crossings: number;
    mismatches: number;
    worstGapUnits: number;
  }[] = [];
  const extent = config.tileExtent;
  for (let zoom = config.tileMinZoom; zoom <= config.tileMaxZoom; zoom++) {
    const span = 2 ** zoom;
    let total = 0;
    let mismatches = 0;
    let example = "";
    let worstGap = 0;
    for (const entry of pack.entries()) {
      if (entry.z !== zoom) continue;
      const tile = tiles.get(zoom, entry.x, entry.y);
      const neighbours: readonly [number, number, 0 | 1][] = [
        [entry.x + 1, entry.y, 0],
        [entry.x, entry.y + 1, 1],
      ];
      for (const [nx, ny, axis] of neighbours) {
        if (nx >= span || ny >= span) continue;
        const neighbour = tiles.get(zoom, nx, ny);
        for (const crossing of crossings(tile, config.layers.areaOutlines, axis, extent)) {
          const along = crossing.point[axis === 0 ? 1 : 0];
          if (along < 0 || along > extent) continue;
          total += 1;
          const there: Local = axis === 0 ? [0, crossing.point[1]] : [crossing.point[0], 0];
          const found = nearest(pieces(neighbour, config.layers.areaOutlines, crossing.id), there);
          const closest = found === null ? Number.POSITIVE_INFINITY : found.distance;
          worstGap = Math.max(worstGap, Number.isFinite(closest) ? closest : 0);
          if (closest > EDGE_MATCH_UNITS) {
            mismatches += 1;
            if (example === "") {
              example = `${zoom}/${entry.x}/${entry.y}->${nx}/${ny} ${crossing.id} gap ${closest.toFixed(2)}`;
            }
          }
        }
      }
    }
    summaries.push({
      level: zoom,
      crossings: total,
      mismatches,
      worstGapUnits: Number(worstGap.toFixed(2)),
    });
    if (mismatches > 0) {
      findings.push({
        featureId: "area_outlines",
        level: zoom,
        rule: "tile-edge-continuity",
        detail: `${mismatches} of ${total} outline crossings lie more than ${EDGE_MATCH_UNITS} tile units from the neighbouring tile's outline (for example ${example})`,
      });
    }
  }
  return summaries;
}

function validateLabels(
  tiles: Tiles,
  areas: readonly PreparedArea[],
  config: PipelineConfig,
  findings: Finding[],
): AreaValidation["labels"] {
  const zoom = config.tileMaxZoom;
  const boundUnits = 1;
  let found = 0;
  let worst = 0;
  for (const area of areas) {
    const { x, y, local } = locate(zoom, area.label, config.tileExtent);
    const tile = tiles.get(zoom, x, y);
    let best = Number.POSITIVE_INFINITY;
    for (const feature of tile?.layers.get(config.layers.areaLabels) ?? []) {
      if (String(feature.properties.id) !== area.id) continue;
      const point = feature.rings[0]?.[0];
      if (point === undefined) continue;
      best = Math.min(best, Math.hypot(point[0] - local[0], point[1] - local[1]));
    }
    if (!Number.isFinite(best)) {
      findings.push({
        featureId: area.id,
        level: zoom,
        rule: "area-label-anchor",
        detail: `no baked label anchor at ${area.label[0]},${area.label[1]}`,
      });
      continue;
    }
    found += 1;
    worst = Math.max(worst, best);
    if (best > boundUnits) {
      findings.push({
        featureId: area.id,
        level: zoom,
        rule: "area-label-anchor",
        detail: `baked label is ${best.toFixed(2)} tile units from its anchor; the bound is ${boundUnits}`,
      });
    }
  }
  return {
    level: zoom,
    expected: areas.length,
    found,
    worstUnits: Number(worst.toFixed(3)),
    boundUnits,
  };
}

export function validateAreaOutlines(
  pack: TilePack,
  areas: readonly PreparedArea[],
  config: PipelineConfig,
): AreaValidation {
  const findings: Finding[] = [];
  const tiles = new Tiles(pack);
  const levels = validateLevels(pack, tiles, areas, config, findings);
  const labels = validateLabels(tiles, areas, config, findings);
  const fidelity = validateFidelity(tiles, areas, config, findings);
  const cracks = validateCracks(tiles, areas, config, findings);
  const outlineEdges = validateOutlineEdges(pack, tiles, config, findings);
  const fillSampler = new TileLandSampler(pack, config.layers.areas);
  const fill = validateTileEdges(pack, fillSampler, config, "areas", [config.layers.areas]);
  findings.push(...fill.findings);
  for (const area of areas) {
    const first = area.ring[0] as Position;
    const last = area.ring[area.ring.length - 1] as Position;
    if (first[0] !== last[0] || first[1] !== last[1]) {
      findings.push({
        featureId: area.id,
        level: null,
        rule: "ring-closure",
        detail: "the densified ring is not closed",
      });
    }
  }
  return {
    passed: findings.length === 0,
    checks: levels.length * 3 + 2 + fill.summaries.length + outlineEdges.length + areas.length,
    findings,
    levels,
    labels,
    fidelity,
    cracks,
    fillEdges: fill.summaries,
    outlineEdges,
    vertexCounts: {
      source: areas.reduce((sum, area) => sum + area.sourceRing.length, 0),
      densified: areas.reduce((sum, area) => sum + area.ring.length, 0),
    },
  };
}
