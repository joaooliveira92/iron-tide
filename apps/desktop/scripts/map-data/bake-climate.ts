import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";

import { loadLayer, parseSourcePins, sha256Hex } from "./sources.ts";
import {
  CLIMATE_BINARY_FILE,
  CLIMATE_PROVENANCE_FILE,
  encodeClimate,
  type ClimateZoneGeometry,
} from "./climate-data.ts";
import { CLIMATE_ZONES, zoneOfKoppen } from "./climate-zones.ts";

type Pair = [number, number];
type PcPolygon = Pair[][];
type PcMulti = PcPolygon[];
interface Clipper {
  intersection: (...geoms: PcMulti[]) => PcMulti;
  union: (...geoms: PcMulti[]) => PcMulti;
}
interface ContourMulti {
  coordinates: number[][][][];
}
interface ContourBuilder {
  size: (size: [number, number]) => ContourBuilder;
  smooth: (smooth: boolean) => ContourBuilder;
  contour: (values: ArrayLike<number>, threshold: number) => ContourMulti;
}
type ContoursFactory = () => ContourBuilder;
interface GeoTiffImage {
  getWidth: () => number;
  getHeight: () => number;
  readRasters: (options: { interleave: boolean }) => Promise<ArrayLike<number>>;
}
interface GeoTiffModule {
  fromArrayBuffer: (buffer: ArrayBuffer) => Promise<{ getImage: () => Promise<GeoTiffImage> }>;
}

const { values } = parseArgs({
  options: {
    tif: { type: "string" },
    tools: { type: "string" },
    cache: { type: "string" },
    "out-dir": { type: "string" },
    "map-data": { type: "string" },
    "source-archive": { type: "string" },
  },
});
const { tif, tools, cache } = values;
const outDir = values["out-dir"];
const mapData = values["map-data"];
if (
  tif === undefined ||
  tools === undefined ||
  cache === undefined ||
  outDir === undefined ||
  mapData === undefined
) {
  throw new Error(
    "usage: bake-climate.ts --tif koppen_geiger_0p1.tif --tools /scratch/with/node_modules --cache .map-data-cache --map-data map-data --out-dir map-data [--source-archive koppen_geiger_tif.zip]",
  );
}

const GRID_BLUR_PASSES = 2;
const CONTOUR_THRESHOLD = 0.42;
const FILL_RADIUS_CELLS = 8;
const OUTPUT_GRID = 0.01;
const MIN_AREA_DEGREES2 = 0.0004;

async function loadTool<T>(name: string, relative: string): Promise<T> {
  return (await import(
    pathToFileURL(join(resolve(tools as string), "node_modules", name, relative)).href
  )) as T;
}

function boxBlur(source: Float32Array, width: number, height: number): Float32Array {
  const horizontal = new Float32Array(source.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const left = source[y * width + Math.max(0, x - 1)] as number;
      const mid = source[y * width + x] as number;
      const right = source[y * width + Math.min(width - 1, x + 1)] as number;
      horizontal[y * width + x] = (left + mid + right) / 3;
    }
  }
  const out = new Float32Array(source.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const up = horizontal[Math.max(0, y - 1) * width + x] as number;
      const mid = horizontal[y * width + x] as number;
      const down = horizontal[Math.min(height - 1, y + 1) * width + x] as number;
      out[y * width + x] = (up + mid + down) / 3;
    }
  }
  return out;
}

function fillNoData(zones: Uint8Array, width: number, height: number): Uint8Array {
  let current = zones;
  for (let pass = 0; pass < FILL_RADIUS_CELLS; pass++) {
    const next = current.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (current[y * width + x] !== 0) continue;
        const votes = new Uint8Array(CLIMATE_ZONES.length + 1);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = y + dy;
            if (ny < 0 || ny >= height) continue;
            const nx = (x + dx + width) % width;
            const zone = current[ny * width + nx] as number;
            if (zone !== 0) votes[zone] = (votes[zone] as number) + 1;
          }
        }
        let best = 0;
        let bestVotes = 0;
        for (let zone = 1; zone < votes.length; zone++) {
          if ((votes[zone] as number) > bestVotes) {
            best = zone;
            bestVotes = votes[zone] as number;
          }
        }
        next[y * width + x] = best;
      }
    }
    current = next;
  }
  return current;
}

function snap(value: number): number {
  return Math.round(value / OUTPUT_GRID) * OUTPUT_GRID;
}

function ringArea(ring: readonly Pair[]): number {
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index++) {
    const a = ring[index] as Pair;
    const b = ring[index + 1] as Pair;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

function cleanRing(ring: readonly Pair[]): Pair[] | null {
  const snapped: Pair[] = [];
  for (const point of ring) {
    const next: Pair = [Number(snap(point[0]).toFixed(2)), Number(snap(point[1]).toFixed(2))];
    const last = snapped[snapped.length - 1];
    if (last === undefined || last[0] !== next[0] || last[1] !== next[1]) snapped.push(next);
  }
  const first = snapped[0];
  const last = snapped[snapped.length - 1];
  if (first !== undefined && last !== undefined && (first[0] !== last[0] || first[1] !== last[1])) {
    snapped.push([first[0], first[1]]);
  }
  return snapped.length >= 4 ? snapped : null;
}

const geotiff = await loadTool<GeoTiffModule>("geotiff", "dist-module/geotiff.js");
const { contours } = await loadTool<{ contours: ContoursFactory }>("d3-contour", "src/index.js");
const clipper = (
  await loadTool<{ default: Clipper }>("polygon-clipping", "dist/polygon-clipping.esm.js")
).default;

const tifBytes = new Uint8Array(await readFile(resolve(tif)));
const image = await (
  await geotiff.fromArrayBuffer(
    tifBytes.buffer.slice(
      tifBytes.byteOffset,
      tifBytes.byteOffset + tifBytes.byteLength,
    ) as ArrayBuffer,
  )
).getImage();
const width = image.getWidth();
const height = image.getHeight();
const raster = (await image.readRasters({ interleave: true })) as ArrayLike<number>;
if (width !== 3600 || height !== 1800) {
  throw new Error(`expected the 0.1 degree grid (3600x1800), got ${width}x${height}`);
}

const zones = new Uint8Array(width * height);
for (let index = 0; index < zones.length; index++) {
  zones[index] = zoneOfKoppen(raster[index] as number);
}
const filled = fillNoData(zones, width, height);

const pins = parseSourcePins(
  JSON.parse(await readFile(resolve(mapData, "sources.v1.json"), "utf8")),
);
const landPins = pins.sources.filter(
  (pin) => pin.id === "ne_10m_land" || pin.id === "ne_10m_minor_islands",
);
const land: PcMulti = [];
for (const pin of landPins) {
  const layer = await loadLayer(pin, resolve(cache));
  for (const polygon of layer.polygons) {
    land.push(polygon.map((ring) => ring.map((point): Pair => [point[0], point[1]])));
  }
}
const SNAP_STEPS = [0, 0.001, 0.0015, 0.002] as const;

function snapMulti(multi: PcMulti, step: number): PcMulti {
  if (step === 0) return multi;
  const round = (value: number): number => Math.round(value / step) * step;
  const out: PcMulti = [];
  for (const polygon of multi) {
    const rings: Pair[][] = [];
    for (const ring of polygon) {
      const next: Pair[] = [];
      for (const point of ring) {
        const snapped: Pair = [round(point[0]), round(point[1])];
        const last = next[next.length - 1];
        if (last === undefined || last[0] !== snapped[0] || last[1] !== snapped[1])
          next.push(snapped);
      }
      if (next.length >= 4) rings.push(next);
    }
    if (rings.length > 0) out.push(rings);
  }
  return out;
}

type Box = readonly [number, number, number, number];

function boxOf(polygon: PcPolygon): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of polygon[0] ?? []) {
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]);
    maxY = Math.max(maxY, point[1]);
  }
  return [minX, minY, maxX, maxY];
}

function overlaps(a: Box, b: Box): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

const landBoxes = land.map(boxOf);
let degraded = 0;

function pieceIntersection(landPolygon: PcPolygon, zonePolygon: PcPolygon): PcMulti {
  for (const step of SNAP_STEPS) {
    try {
      return clipper.intersection(snapMulti([landPolygon], step), snapMulti([zonePolygon], step));
    } catch {
      continue;
    }
  }
  degraded += 1;
  return [];
}

function safeIntersection(zoneMulti: PcMulti): PcMulti {
  const out: PcMulti = [];
  for (const zonePolygon of zoneMulti) {
    const zoneBox = boxOf(zonePolygon);
    land.forEach((landPolygon, index) => {
      if (!overlaps(landBoxes[index] as Box, zoneBox)) return;
      out.push(...pieceIntersection(landPolygon, zonePolygon));
    });
  }
  return out;
}

const outZones: ClimateZoneGeometry[] = [];
let totalVertices = 0;
for (const zone of CLIMATE_ZONES) {
  const field = new Float32Array(width * height);
  for (let index = 0; index < field.length; index++) {
    field[index] = filled[index] === zone.id ? 1 : 0;
  }
  let smooth: Float32Array = field;
  for (let pass = 0; pass < GRID_BLUR_PASSES; pass++) smooth = boxBlur(smooth, width, height);
  const contour = contours().size([width, height]).smooth(true).contour(smooth, CONTOUR_THRESHOLD);
  const lonLat: PcMulti = contour.coordinates.map((polygon) =>
    polygon.map((ring) =>
      ring.map((point): Pair => [
        -180 + ((point[0] as number) - 0.5) * 0.1,
        90 - ((point[1] as number) - 0.5) * 0.1,
      ]),
    ),
  );
  console.log(`zone ${zone.id} ${zone.name}: ${lonLat.length} raw polygons, clipping to land`);
  const clipped = safeIntersection(lonLat);
  const polygons: Pair[][][] = [];
  for (const polygon of clipped) {
    const rings: Pair[][] = [];
    polygon.forEach((ring, index) => {
      const cleaned = cleanRing(ring);
      if (cleaned === null) return;
      if (ringArea(cleaned) < MIN_AREA_DEGREES2) {
        if (index === 0) rings.length = 0;
        return;
      }
      if (index === 0 || rings.length > 0) rings.push(cleaned);
    });
    if (rings.length === 0) continue;
    totalVertices += rings.reduce((sum, ring) => sum + ring.length, 0);
    polygons.push(rings);
  }
  outZones.push({ zone: zone.id, polygons });
  console.log(`  -> ${polygons.length} polygons`);
}

const archive =
  values["source-archive"] === undefined
    ? undefined
    : createHash("sha256")
        .update(new Uint8Array(await readFile(resolve(values["source-archive"]))))
        .digest("hex");

const binary = encodeClimate(outZones);
const provenance = {
  schemaVersion: 1,
  binarySha256: sha256Hex(binary),
  binaryBytes: binary.length,
  source: {
    name: "Koppen-Geiger V3 (Beck et al. 2023)",
    citation:
      "Beck, H. E., McVicar, T. R., Vergopolan, N., Berg, A., Lutsko, N. J., Dufour, A., Zeng, Z., Jiang, X., van Dijk, A. I. J. M., Miralles, D. G. High-resolution (1 km) Koppen-Geiger maps for 1901-2099 based on constrained CMIP6 projections. Scientific Data 10, 724 (2023).",
    doi: "10.1038/s41597-023-02549-6",
    dataDoi: "10.6084/m9.figshare.21789074",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    period: "1991-2020",
    file: "1991_2020/koppen_geiger_0p1.tif",
    fileSha256: sha256Hex(tifBytes),
    archiveUrl: "https://ndownloader.figshare.com/files/61012822",
    archiveSha256: archive ?? "unrecorded",
  },
  method: {
    grid: "0.1 degree, 3600x1800",
    noDataFill: `nearest-neighbour majority, ${FILL_RADIUS_CELLS} cells`,
    smoothing: `${GRID_BLUR_PASSES} box-blur passes, marching squares at ${CONTOUR_THRESHOLD}`,
    clip: "per-polygon intersection with Natural Earth 10m land and minor islands",
    outputGridDegrees: OUTPUT_GRID,
    toolchain: "geotiff, d3-contour, polygon-clipping installed in a scratch directory",
  },
  zones: CLIMATE_ZONES.map(({ id, name, koppen }) => ({ id, name, koppen: [...koppen] })),
};
await writeFile(join(resolve(outDir), CLIMATE_BINARY_FILE), binary);
await writeFile(
  join(resolve(outDir), CLIMATE_PROVENANCE_FILE),
  `${JSON.stringify(provenance, null, 2)}\n`,
);
console.log(`pieces dropped after every snap step failed: ${degraded}`);
console.log(`wrote ${binary.length} bytes, ${totalVertices} vertices, sha256 ${sha256Hex(binary)}`);
