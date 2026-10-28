import type { Resolution, ResolvedOverlay } from "./bake.ts";
import type { ProtectedCatalogue, ProtectedFeature } from "./catalogue.ts";
import type { PipelineConfig } from "./config.ts";
import {
  densifyRingLonLat,
  distanceToPolylineMetres,
  interpolateLonLat,
  metresBetween,
  metresPerPixelAtZoom,
  pointInRing,
  type Position,
} from "./geodesy.ts";
import { decodeTile, lonLatToTileLocal, tileToLonLat, type DecodedTile } from "./mvt.ts";
import { measureTransect, type WaterInterval } from "./passage.ts";
import type { TilePack } from "../../src/renderer/components/globe-spike/tilepack.ts";

export interface Finding {
  readonly featureId: string;
  readonly level: number | null;
  readonly rule: string;
  readonly detail: string;
}

export interface FeatureLevelResult {
  readonly featureId: string;
  readonly level: number;
  readonly kind: "transect" | "overlay";
  readonly passed: boolean;
  readonly metrics: Readonly<Record<string, number | string | boolean>>;
}

export interface TileEdgeSummary {
  readonly level: number;
  readonly pairsChecked: number;
  readonly samples: number;
  readonly mismatches: number;
  readonly ambiguous: number;
}

export interface ValidationReport {
  readonly passed: boolean;
  readonly findings: readonly Finding[];
  readonly results: readonly FeatureLevelResult[];
  readonly tileEdges: readonly TileEdgeSummary[];
  readonly checks: number;
}

const UNIT_STEP_CAP_METRES = 100;
const EDGE_SAMPLES = 24;
const AMBIGUITY_UNITS = 1.5;

export class TileLandSampler {
  private readonly pack: TilePack;
  private readonly cache = new Map<string, DecodedTile | null>();
  private readonly layer: string;

  constructor(pack: TilePack, layer: string) {
    this.pack = pack;
    this.layer = layer;
  }

  tile(z: number, x: number, y: number): DecodedTile | null {
    const key = `${z}/${x}/${y}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;
    const bytes = this.pack.get(z, x, y);
    const decoded = bytes === null ? null : decodeTile(bytes);
    this.cache.set(key, decoded);
    return decoded;
  }

  landAtLocal(z: number, x: number, y: number, local: readonly [number, number]): boolean {
    const tile = this.tile(z, x, y);
    if (tile === null) return false;
    const features = tile.layers.get(this.layer) ?? [];
    let inside = false;
    for (const feature of features) {
      if (feature.type !== 3) continue;
      for (const ring of feature.rings) {
        if (pointInRing([local[0], local[1]], ring)) inside = !inside;
      }
    }
    return inside;
  }

  isLand(z: number, position: Position, extent: number): boolean {
    const { x, y, local } = lonLatToTileLocal(z, position, extent);
    return this.landAtLocal(z, x, y, local);
  }
}

function tileUnitMetres(zoom: number, latitude: number, config: PipelineConfig): number {
  return (metresPerPixelAtZoom(zoom, latitude) * 512) / config.tileExtent;
}

function overlayPieces(
  pack: TilePack,
  zoom: number,
  featureId: string,
  config: PipelineConfig,
): {
  readonly lines: (readonly Position[])[];
  readonly byTile: Map<string, (readonly Position[])[]>;
} {
  const lines: (readonly Position[])[] = [];
  const byTile = new Map<string, (readonly Position[])[]>();
  for (const entry of pack.entries()) {
    if (entry.z !== zoom) continue;
    const decoded = decodeTile(pack.read(entry));
    for (const feature of decoded.layers.get(config.layers.protected) ?? []) {
      if (feature.properties.id !== featureId || feature.type !== 2) continue;
      for (const ring of feature.rings) {
        const line = ring.map((point) =>
          tileToLonLat(zoom, entry.x, entry.y, point, decoded.extent),
        );
        lines.push(line);
        const key = `${entry.x}/${entry.y}`;
        byTile.set(key, [...(byTile.get(key) ?? []), line]);
      }
    }
  }
  return { lines, byTile };
}

function strokeCovers(
  position: Position,
  lines: readonly (readonly Position[])[],
  halfWidthMetres: number,
): boolean {
  return lines.some((line) => distanceToPolylineMetres(position, line) <= halfWidthMetres);
}

function authoredLines(overlay: ResolvedOverlay, toleranceMetres: number): (readonly Position[])[] {
  return overlay.lines.map((line) => [...densifyRingLonLat(line, toleranceMetres)]);
}

function validateOverlay(
  feature: ProtectedFeature,
  overlay: ResolvedOverlay,
  pack: TilePack,
  sampler: TileLandSampler,
  config: PipelineConfig,
  findings: Finding[],
  results: FeatureLevelResult[],
): void {
  const authored = authoredLines(overlay, config.densifyToleranceMetres);
  for (
    let zoom = Math.max(feature.requiredFromZoom, config.tileMinZoom);
    zoom <= config.tileMaxZoom;
    zoom++
  ) {
    const latitude = authored[0]?.[0]?.[1] ?? 0;
    const unit = tileUnitMetres(zoom, latitude, config);
    const pieces = overlayPieces(pack, zoom, feature.id, config);
    const halfWidth = (overlay.renderedWidthPixels / 2) * metresPerPixelAtZoom(zoom, latitude);
    const before = findings.length;
    if (pieces.lines.length === 0) {
      findings.push({
        featureId: feature.id,
        level: zoom,
        rule: "overlay-present",
        detail: "no overlay geometry in any tile",
      });
      results.push({
        featureId: feature.id,
        level: zoom,
        kind: "overlay",
        passed: false,
        metrics: { pieces: 0 },
      });
      continue;
    }
    let maxCoverageGap = 0;
    let longestGapRun = 0;
    let gapRun = 0;
    let sealedSamples = 0;
    let samples = 0;
    let tileEdgeCrossings = 0;
    let tileEdgeGaps = 0;
    const sampleStep = Math.max(unit * 4, 50);
    for (const line of authored) {
      let previousTile = "";
      let previousPoint: Position | null = null;
      for (let index = 0; index + 1 < line.length; index++) {
        const a = line[index] as Position;
        const b = line[index + 1] as Position;
        const length = metresBetween(a, b);
        const count = Math.max(1, Math.ceil(length / sampleStep));
        for (let step = 0; step <= count; step++) {
          const point = interpolateLonLat(a, b, step / count);
          samples += 1;
          const gap = nearestGap(point, pieces.lines);
          maxCoverageGap = Math.max(maxCoverageGap, gap);
          if (gap > 2 * Math.max(unit, 1)) {
            gapRun += sampleStep;
            longestGapRun = Math.max(longestGapRun, gapRun);
          } else gapRun = 0;
          const landHere = sampler.isLand(zoom, point, config.tileExtent);
          if (landHere && !strokeCovers(point, pieces.lines, Math.max(halfWidth, unit)))
            sealedSamples += 1;
          const local = lonLatToTileLocal(zoom, point, config.tileExtent);
          const key = `${local.x}/${local.y}`;
          if (previousTile !== "" && key !== previousTile && previousPoint !== null) {
            tileEdgeCrossings += 1;
            const here = pieces.byTile.get(key) ?? [];
            const there = pieces.byTile.get(previousTile) ?? [];
            const nearHere = here.some(
              (piece) => distanceToPolylineMetres(point, piece) <= 2 * unit + 1,
            );
            const nearThere = there.some(
              (piece) => distanceToPolylineMetres(previousPoint as Position, piece) <= 2 * unit + 1,
            );
            if (!nearHere || !nearThere) tileEdgeGaps += 1;
          }
          previousTile = key;
          previousPoint = point;
        }
      }
    }
    let orphanVertices = 0;
    for (const piece of pieces.lines) {
      for (const vertex of piece) {
        const distance = Math.min(
          ...authored.map((line) => distanceToPolylineMetres(vertex, line)),
        );
        if (distance > feature.maxDisplacementMetres) orphanVertices += 1;
      }
    }
    if (maxCoverageGap > feature.maxDisplacementMetres) {
      findings.push({
        featureId: feature.id,
        level: zoom,
        rule: "max-displacement",
        detail: `overlay deviates ${maxCoverageGap.toFixed(0)} m from the authored line; limit ${feature.maxDisplacementMetres} m`,
      });
    }
    if (longestGapRun > 0) {
      findings.push({
        featureId: feature.id,
        level: zoom,
        rule: "continuity",
        detail: `overlay gap of about ${longestGapRun.toFixed(0)} m along the centreline`,
      });
    }
    if (sealedSamples > 0) {
      findings.push({
        featureId: feature.id,
        level: zoom,
        rule: "sealed-land",
        detail: `${sealedSamples} of ${samples} centreline samples are land with no overlay stroke`,
      });
    }
    if (tileEdgeGaps > 0) {
      findings.push({
        featureId: feature.id,
        level: zoom,
        rule: "tile-edge-continuity",
        detail: `${tileEdgeGaps} of ${tileEdgeCrossings} tile-edge crossings lack overlay on one side`,
      });
    }
    if (orphanVertices > 0) {
      findings.push({
        featureId: feature.id,
        level: zoom,
        rule: "orphan-segment",
        detail: `${orphanVertices} overlay vertices lie farther than ${feature.maxDisplacementMetres} m from the authored line`,
      });
    }
    let duplicates = 0;
    for (const tilePieces of pieces.byTile.values()) {
      const keys = tilePieces.map((piece) =>
        JSON.stringify(
          piece.map((point) => [Number(point[0].toFixed(7)), Number(point[1].toFixed(7))]),
        ),
      );
      duplicates += keys.length - new Set(keys).size;
    }
    if (duplicates > 0) {
      findings.push({
        featureId: feature.id,
        level: zoom,
        rule: "duplicate-overlay",
        detail: `${duplicates} duplicated overlay pieces`,
      });
    }
    results.push({
      featureId: feature.id,
      level: zoom,
      kind: "overlay",
      passed: findings.length === before,
      metrics: {
        pieces: pieces.lines.length,
        maxCoverageGapMetres: Number(maxCoverageGap.toFixed(1)),
        longestGapRunMetres: Number(longestGapRun.toFixed(1)),
        sealedSamples,
        samples,
        tileEdgeCrossings,
        tileEdgeGaps,
        orphanVertices,
        duplicates,
        unitMetres: Number(unit.toFixed(2)),
        renderedWidthMetres: Number((halfWidth * 2).toFixed(1)),
      },
    });
  }
}

function nearestGap(point: Position, lines: readonly (readonly Position[])[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const line of lines) best = Math.min(best, distanceToPolylineMetres(point, line));
  return best;
}

function longestOf(intervals: readonly WaterInterval[]): WaterInterval | null {
  let best: WaterInterval | null = null;
  for (const interval of intervals) {
    if (
      best === null ||
      interval.endMetres - interval.startMetres > best.endMetres - best.startMetres
    )
      best = interval;
  }
  return best;
}

function validateStrait(
  feature: ProtectedFeature,
  resolution: Resolution,
  overlays: readonly ResolvedOverlay[],
  sampler: TileLandSampler,
  pack: TilePack,
  config: PipelineConfig,
  findings: Finding[],
  results: FeatureLevelResult[],
): void {
  const passages = resolution.passages.filter((passage) => passage.featureId === feature.id);
  const overlay = overlays.find((entry) => entry.featureId === feature.id);
  const reference = feature.referenceWidthMetres ?? 0;
  const anyOpenSource = passages.some((passage) => !passage.sealed);
  for (const passage of passages) {
    if (!passage.source.startsOnLand || !passage.source.endsOnLand) {
      findings.push({
        featureId: feature.id,
        level: null,
        rule: "probe-endpoints",
        detail: `transect ${passage.transectId} does not start and end on land in the pinned source`,
      });
    }
    if (passage.sealed) continue;
    if (
      passage.source.longestWaterMetres > 1.5 * reference ||
      passage.source.longestWaterMetres < reference / 1.5
    ) {
      findings.push({
        featureId: feature.id,
        level: null,
        rule: "reference-width",
        detail: `source passage width ${passage.source.longestWaterMetres.toFixed(0)} m differs from the catalogue reference ${reference} m by more than 50%`,
      });
    }
  }
  for (
    let zoom = Math.max(feature.requiredFromZoom, config.tileMinZoom);
    zoom <= config.tileMaxZoom;
    zoom++
  ) {
    const latitude = passages[0]?.from[1] ?? 0;
    const mpp = metresPerPixelAtZoom(zoom, latitude);
    const step = Math.min(UNIT_STEP_CAP_METRES, tileUnitMetres(zoom, latitude, config));
    const stroke = overlay === undefined ? [] : overlayPieces(pack, zoom, feature.id, config).lines;
    const halfWidth = overlay === undefined ? 0 : (overlay.renderedWidthPixels / 2) * mpp;
    for (const passage of passages) {
      const before = findings.length;
      const isWater = (position: Position): boolean =>
        !sampler.isLand(zoom, position, config.tileExtent) ||
        (stroke.length > 0 && strokeCovers(position, stroke, halfWidth));
      const measured = measureTransect(
        (position) => !isWater(position),
        passage.from,
        passage.to,
        Math.max(step, 5),
      );
      const required = (1 - feature.maxNarrowingFraction) * passage.source.longestWaterMetres;
      if (measured.longestWaterMetres <= 0) {
        findings.push({
          featureId: feature.id,
          level: zoom,
          rule: "closure",
          detail: `passage along ${passage.transectId} is sealed by land`,
        });
      } else if (measured.longestWaterMetres < required) {
        findings.push({
          featureId: feature.id,
          level: zoom,
          rule: "max-narrowing",
          detail: `passage ${measured.longestWaterMetres.toFixed(0)} m is narrower than ${required.toFixed(0)} m (source ${passage.source.longestWaterMetres.toFixed(0)} m, allowed narrowing ${feature.maxNarrowingFraction})`,
        });
      }
      const sourceLongest = passage.source.longest;
      const tileLongest = longestOf(measured.water);
      if (sourceLongest !== null && tileLongest !== null) {
        const shift = Math.abs(
          (tileLongest.startMetres + tileLongest.endMetres) / 2 -
            (sourceLongest.startMetres + sourceLongest.endMetres) / 2,
        );
        if (shift > feature.maxDisplacementMetres) {
          findings.push({
            featureId: feature.id,
            level: zoom,
            rule: "max-displacement",
            detail: `passage centre moved ${shift.toFixed(0)} m; limit ${feature.maxDisplacementMetres} m`,
          });
        }
      }
      results.push({
        featureId: feature.id,
        level: zoom,
        kind: "transect",
        passed: findings.length === before,
        metrics: {
          transect: passage.transectId,
          sourceWidthMetres: Number(passage.source.longestWaterMetres.toFixed(0)),
          levelWidthMetres: Number(measured.longestWaterMetres.toFixed(0)),
          requiredMetres: Number(required.toFixed(0)),
          overlayInjected: overlay !== undefined,
          sourceSealed: passage.sealed,
          anyOpenSource,
        },
      });
    }
  }
}

export function validateTileEdges(
  pack: TilePack,
  sampler: TileLandSampler,
  config: PipelineConfig,
  label: string,
  populationLayers: readonly string[],
): { readonly summaries: TileEdgeSummary[]; readonly findings: Finding[] } {
  const summaries: TileEdgeSummary[] = [];
  const findings: Finding[] = [];
  const extent = config.tileExtent;
  const populated = new Map<number, Set<string>>();
  for (const entry of pack.entries()) {
    const tile = sampler.tile(entry.z, entry.x, entry.y);
    if (!populationLayers.some((layer) => (tile?.layers.get(layer)?.length ?? 0) > 0)) continue;
    const set = populated.get(entry.z) ?? new Set<string>();
    set.add(`${entry.x}/${entry.y}`);
    populated.set(entry.z, set);
  }
  for (let zoom = config.tileMinZoom; zoom <= config.tileMaxZoom; zoom++) {
    const tiles = populated.get(zoom) ?? new Set<string>();
    const span = 2 ** zoom;
    let pairs = 0;
    let samples = 0;
    let mismatches = 0;
    let ambiguous = 0;
    const firstMismatch: string[] = [];
    for (const key of [...tiles].sort()) {
      const [xs, ys] = key.split("/");
      const x = Number(xs);
      const y = Number(ys);
      const neighbours: readonly [number, number, "east" | "south"][] = [
        [x + 1, y, "east"],
        [x, y + 1, "south"],
      ];
      for (const [nx, ny, direction] of neighbours) {
        if (nx >= span || ny >= span) continue;
        if (!tiles.has(`${nx}/${ny}`) && !tiles.has(key)) continue;
        pairs += 1;
        for (let sample = 0; sample < EDGE_SAMPLES; sample++) {
          const along = ((sample + 0.5) / EDGE_SAMPLES) * extent;
          const a: [number, number] = direction === "east" ? [extent, along] : [along, extent];
          const b: [number, number] = direction === "east" ? [0, along] : [along, 0];
          const landA = sampler.landAtLocal(zoom, x, y, a);
          const landB = sampler.landAtLocal(zoom, nx, ny, b);
          samples += 1;
          if (landA === landB) continue;
          const wobble = (point: [number, number], tx: number, ty: number): boolean[] => {
            const out: boolean[] = [];
            for (const delta of [-AMBIGUITY_UNITS, AMBIGUITY_UNITS]) {
              const shifted: [number, number] =
                direction === "east" ? [point[0], point[1] + delta] : [point[0] + delta, point[1]];
              out.push(sampler.landAtLocal(zoom, tx, ty, shifted));
            }
            return out;
          };
          const sideA = [landA, ...wobble(a, x, y)];
          const sideB = [landB, ...wobble(b, nx, ny)];
          if (
            new Set([...sideA, ...sideB]).size > 1 &&
            (new Set(sideA).size > 1 || new Set(sideB).size > 1)
          ) {
            ambiguous += 1;
          } else {
            mismatches += 1;
            if (firstMismatch.length < 3) firstMismatch.push(`${zoom}/${x}/${y}->${nx}/${ny}`);
          }
        }
      }
    }
    summaries.push({ level: zoom, pairsChecked: pairs, samples, mismatches, ambiguous });
    if (mismatches > 0) {
      findings.push({
        featureId: label,
        level: zoom,
        rule: "tile-edge-continuity",
        detail: `${mismatches} of ${samples} shared-edge samples disagree between neighbouring tiles (for example ${firstMismatch.join(", ")})`,
      });
    }
  }
  return { summaries, findings };
}

export function validateProtectedFeatures(
  pack: TilePack,
  catalogue: ProtectedCatalogue,
  resolution: Resolution,
  config: PipelineConfig,
): ValidationReport {
  const sampler = new TileLandSampler(pack, config.layers.land);
  const findings: Finding[] = [];
  const results: FeatureLevelResult[] = [];
  for (const feature of catalogue.features) {
    const overlay = resolution.overlays.find((entry) => entry.featureId === feature.id);
    if (feature.representation === "overlay-line") {
      if (overlay === undefined) {
        findings.push({
          featureId: feature.id,
          level: null,
          rule: "overlay-resolved",
          detail: "no overlay geometry was resolved",
        });
        continue;
      }
      validateOverlay(feature, overlay, pack, sampler, config, findings, results);
    } else {
      validateStrait(
        feature,
        resolution,
        resolution.overlays,
        sampler,
        pack,
        config,
        findings,
        results,
      );
    }
  }
  const edges = validateTileEdges(pack, sampler, config, "land", [
    config.layers.land,
    config.layers.protected,
  ]);
  findings.push(...edges.findings);
  return {
    passed: findings.length === 0,
    findings,
    results,
    tileEdges: edges.summaries,
    checks: results.length + edges.summaries.length,
  };
}
