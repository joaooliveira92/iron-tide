/**
 * Author-time bake for the 1880 political borders of the playable nations.
 *
 * Reads `world_1880.geojson` from aourednik/historical-basemaps
 * (https://github.com/aourednik/historical-basemaps, GPL-3.0; its own caveat is
 * that the maps are "work in progress" and borders at world scale), keeps the
 * features that belong to a playable nation (the nation itself plus the
 * territories it held) and clips them to the map's own coastline
 * (`coastline-data.ts`, Natural Earth 1:10m). The 1880 source is far coarser than
 * the coast, so a plain copy leaves its coastal edge a few kilometres off the
 * real shore; clipping makes the coast of each nation the coast the map draws,
 * and only the inland frontiers stay as coarse as the source.
 *
 * For each nation the result is
 *   (coarse ∩ land)  ∪  ((coarse grown by COAST_REACH ∩ land) − every other 1880 polygon)
 * The second term takes back the strip of real land that the coarse polygon
 * stops short of at the coast, without moving any frontier with a neighbour.
 * Nothing is fetched at runtime and the clipper is not a project dependency.
 *
 * Run (the GeoJSON is untrusted input: pass it by path, from a directory of its own;
 * the clipper is `polygon-clipping`, installed in a scratch directory outside the repo):
 *   /path/to/node_modules/.bin/tsx apps/desktop/src/renderer/components/world-map/bake-borders.ts \
 *     /path/to/world_1880.geojson /path/to/node_modules/polygon-clipping/dist/polygon-clipping.esm.js
 *
 * See docs/adr/ for the provenance and licensing note that goes with this data.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decodeCoastline, encodeCoastline } from "../../lib/coastline-codec.js";
import { COASTLINE_BASE64 } from "./coastline-data.js";

/** Playable campaign nation id -> dataset features to include (by SUBJECTO or NAME). */
const NATIONS: Readonly<Record<string, { subjects: string[]; names?: string[] }>> = {
  uk: {
    subjects: ["United Kingdom of Great Britain and Ireland", "United Kingdom", "Great Britain"],
  },
  france: { subjects: ["France"] },
  germany: { subjects: ["Germany"] },
  italy: { subjects: ["Italy"] },
  spain: { subjects: ["Spain"] },
  russia: { subjects: ["Russian Empire"] },
  austria_hungary: { subjects: ["Austria Hungary"] },
  usa: { subjects: ["United States of America"] },
  japan: { subjects: ["Imperial Japan"] },
  qing: { subjects: ["Manchu Empire"], names: ["Taiwan"] },
};

/** Degrees a coarse polygon may be grown seaward-to-landward to reach the real coast. */
const COAST_REACH = 0.3;
/** The 8 compass directions the polygon is shifted in to grow it (a square Minkowski sum). */
const SHIFTS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

type Pair = [number, number];
type PcPolygon = Pair[][];
type PcMulti = PcPolygon[];
interface Clipper {
  union: (...geoms: PcMulti[]) => PcMulti;
  intersection: (...geoms: PcMulti[]) => PcMulti;
  difference: (...geoms: PcMulti[]) => PcMulti;
}

interface Feature {
  properties: { NAME: string; SUBJECTO: string };
  geometry: { type: string; coordinates: unknown };
}

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const [source, clipperPath] = process.argv.slice(2);
if (source === undefined || clipperPath === undefined) {
  throw new Error(
    "usage: bake-borders.ts /path/to/world_1880.geojson /path/to/polygon-clipping.esm.js",
  );
}
const raw = ((await import(pathToFileURL(clipperPath).href)) as { default: Clipper }).default;

const snap = (geoms: PcMulti[], step: number): PcMulti[] =>
  geoms.map((multi) =>
    multi.map((polygon) =>
      polygon.map((ring) =>
        ring.map(([x, y]) => [Math.round(x / step) * step, Math.round(y / step) * step] as Pair),
      ),
    ),
  );

/**
 * polygon-clipping is exact in theory and occasionally trips on floating-point noise where two
 * edges almost coincide (the intersection points of an earlier step are off-grid). Retrying with
 * the inputs snapped to a progressively coarser grid (down to 0.001°, a tenth of the 0.01° output
 * grid) is deterministic and invisible.
 */
const SNAP_STEPS = [1e-6, 1e-5, 1e-4, 1e-3] as const;

function guarded(op: keyof Clipper): (...geoms: PcMulti[]) => PcMulti {
  return (...geoms) => {
    for (let attempt = -1; ; attempt++) {
      try {
        const step = SNAP_STEPS[attempt];
        return raw[op](...(step === undefined ? geoms : snap(geoms, step)));
      } catch (error) {
        if (attempt >= SNAP_STEPS.length - 1) throw error;
      }
    }
  };
}
const clipper: Clipper = {
  union: guarded("union"),
  intersection: guarded("intersection"),
  difference: guarded("difference"),
};
const collection = JSON.parse(readFileSync(source, "utf8")) as { features: Feature[] };

function multiOf(feature: Feature): PcMulti {
  const { type, coordinates } = feature.geometry;
  const parts =
    type === "MultiPolygon"
      ? (coordinates as number[][][][])
      : type === "Polygon"
        ? [coordinates as number[][][]]
        : [];
  return parts.map((part) => part.map((ring) => ring.map(([x, y]) => [x, y] as Pair)));
}

function boxOf(multi: PcMulti): Box {
  const box: Box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const polygon of multi) {
    for (const [x, y] of polygon[0] ?? []) {
      if (x < box.minX) box.minX = x;
      if (x > box.maxX) box.maxX = x;
      if (y < box.minY) box.minY = y;
      if (y > box.maxY) box.maxY = y;
    }
  }
  return box;
}

const touches = (a: Box, b: Box) =>
  a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;

const closed = (flat: readonly number[]): Pair[] => {
  const ring: Pair[] = [];
  for (let k = 0; k < flat.length; k += 2) ring.push([flat[k] as number, flat[k + 1] as number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first !== undefined && last !== undefined && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
};

const binary = atob(COASTLINE_BASE64);
const bytes = new Uint8Array(binary.length);
for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
const land: { multi: PcMulti; box: Box }[] = decodeCoastline(bytes.buffer).map((rings) => {
  const multi: PcMulti = [rings.map(closed)];
  return { multi, box: boxOf(multi) };
});

const features = collection.features.map((feature) => {
  const multi = multiOf(feature);
  return { feature, multi, box: boxOf(multi) };
});

const round = (value: number) => Math.round(value * 100) / 100;
const result: Record<string, number[][][]> = {};

for (const [nation, rule] of Object.entries(NATIONS)) {
  const own = features.filter(
    ({ feature }) =>
      rule.subjects.includes(feature.properties.SUBJECTO) ||
      (rule.names ?? []).includes(feature.properties.NAME),
  );
  if (own.length === 0) throw new Error(`no features matched for ${nation}`);
  const coarse = clipper.union(...own.map(({ multi }) => multi));
  const grown = clipper.union(
    coarse,
    ...SHIFTS.map(([dx, dy]) =>
      coarse.map((polygon) =>
        polygon.map((ring) =>
          ring.map(([x, y]) => [x + dx * COAST_REACH, y + dy * COAST_REACH] as Pair),
        ),
      ),
    ),
  );
  const reach = boxOf(grown);
  const ownSet = new Set(own.map(({ feature }) => feature));
  const nearbyLand = land.filter(({ box }) => touches(box, reach)).map(({ multi }) => multi);
  const others = features
    .filter(({ feature, box }) => !ownSet.has(feature) && touches(box, reach))
    .map(({ multi }) => multi);

  // Land polygons never overlap, so they are clipped one by one rather than unioned first.
  const reachable = nearbyLand.flatMap((piece) => clipper.intersection(grown, piece));
  const region = clipper.union(
    clipper.intersection(coarse, reachable),
    others.length === 0 ? reachable : clipper.difference(reachable, ...others),
  );

  const polygons: number[][][] = [];
  for (const polygon of region) {
    const rings = polygon
      .map((ring) => {
        const flat: number[] = [];
        let previous: string | null = null;
        // Drop the closing duplicate and any point the 0.01 quantisation collapses onto its neighbour.
        for (const [x, y] of ring.slice(0, -1)) {
          const key = `${round(x)},${round(y)}`;
          if (key === previous) continue;
          previous = key;
          flat.push(round(x), round(y));
        }
        return flat;
      })
      .filter((flat) => flat.length >= 6);
    if (rings.length > 0 && (polygon[0]?.length ?? 0) > 0 && rings[0] !== undefined)
      polygons.push(rings);
  }
  if (polygons.length === 0) throw new Error(`nothing left of ${nation} after clipping`);
  result[nation] = polygons;
  console.log(`${nation}: ${polygons.length} polygons`);
}

const here = dirname(fileURLToPath(import.meta.url));
const entries = Object.entries(result).map(
  ([nation, polygons]) =>
    `  ${nation}: "${Buffer.from(encodeCoastline(polygons)).toString("base64")}",\n`,
);
const header = `/**
 * GENERATED by bake-borders.ts — do not edit.
 *
 * 1880 borders of the playable nations (and the territories each held), clipped to
 * the map's coastline, as flat [lon, lat, …] rings. Source: aourednik/historical-basemaps,
 * world_1880.geojson (GPL-3.0; approximate, world-scale) ∩ Natural Earth 1:10m land.
 * Each nation is encoded with lib/coastline-codec.ts and base64'd. Presentation only:
 * the engine never reads it.
 */

import { decodeCoastline } from "../../lib/coastline-codec.js";
import type { FlatPolygon } from "../../lib/simplify-geometry.js";

const ENCODED: Readonly<Record<string, string>> = {
`;
const footer = `};

function decode(base64: string): FlatPolygon[] {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return decodeCoastline(bytes.buffer);
}

export const BORDERS_1880: Readonly<Record<string, readonly FlatPolygon[]>> = Object.fromEntries(
  Object.entries(ENCODED).map(([nation, base64]) => [nation, decode(base64)]),
);
`;
writeFileSync(join(here, "borders-1880-data.ts"), `${header}${entries.join("")}${footer}`);
const total = Object.values(result).reduce(
  (n, polys) => n + polys.reduce((m, p) => m + p.reduce((k, r) => k + r.length / 2, 0), 0),
  0,
);
console.log(`wrote borders-1880-data.ts: ${Object.keys(result).length} nations, ${total} points`);
