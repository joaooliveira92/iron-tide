import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { decodeCoastline, encodeCoastline } from "../../lib/coastline-codec.js";
import { COASTLINE_BASE64 } from "./coastline-data.js";
import { deriveBorderFrontiers } from "./border-frontiers.js";

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

const COAST_REACH = 0.3;
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
const coast = decodeCoastline(bytes.buffer);
const land: { multi: PcMulti; box: Box }[] = coast.map((rings) => {
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

const frontiers = deriveBorderFrontiers(result, coast);
const frontierEntries = Object.entries(frontiers).map(
  ([nation, lines]) =>
    `  ${nation}: "${Buffer.from(encodeCoastline(lines.map((line) => [line]))).toString("base64")}",\n`,
);
const frontierHeader = `import { decodeCoastline } from "../../lib/coastline-codec.js";
import type { FlatRing } from "../../lib/simplify-geometry.js";

const ENCODED: Readonly<Record<string, string>> = {
`;
const frontierFooter = `};

function decode(base64: string): FlatRing[] {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return decodeCoastline(bytes.buffer).flatMap((rings) => (rings[0] === undefined ? [] : [rings[0]]));
}

export const BORDER_FRONTIERS_1880: Readonly<Record<string, readonly FlatRing[]>> =
  Object.fromEntries(Object.entries(ENCODED).map(([nation, base64]) => [nation, decode(base64)]));
`;
writeFileSync(
  join(here, "borders-1880-frontiers-data.ts"),
  `${frontierHeader}${frontierEntries.join("")}${frontierFooter}`,
);

const total = Object.values(result).reduce(
  (n, polys) => n + polys.reduce((m, p) => m + p.reduce((k, r) => k + r.length / 2, 0), 0),
  0,
);
console.log(`wrote borders-1880-data.ts: ${Object.keys(result).length} nations, ${total} points`);
