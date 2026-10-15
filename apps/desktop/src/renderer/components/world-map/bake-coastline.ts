/**
 * Author-time bake for the world-map coastline (ADR-0055). Originally written
 * for the map-rendering prototype (ticket 06); now the production data source.
 *
 * One-off author-time bake for ticket 06's geometry-source question. Fetches
 * Natural Earth land (public domain), decodes it, and emits plain lon/lat
 * rings as a base64'd compact binary (see lib/coastline-codec.ts).
 *
 * Two things this deliberately proves, both claims from ticket 13's research:
 *
 * 1. The geometry pipeline runs entirely at author time and needs no runtime
 *    dependency — no d3-geo, no topojson-client, nothing added to
 *    apps/desktop/package.json. TopoJSON arc decoding is the ~40 lines below.
 * 2. TopoJSON's compaction is worth having, so the *projection* can stay at
 *    render time and the projection choice becomes a live toggle rather than a
 *    bake-time commitment.
 *
 * **Tier is the fidelity knob.** Natural Earth publishes three, and the number
 * is the map scale each is *drawn for*: 110m is a world thumbnail, 50m a
 * continent, 10m a coastline. The camera zooms to 14x (useMapCamera's
 * MAX_SCALE), which is roughly 1:1.5M at the equator — two whole tiers past
 * what 110m carries, which is why 110m goes visibly polygonal when you zoom
 * into the Aegean or the Danish straits. For a naval game the coast *is* the
 * subject, so 10m is the default here.
 *
 * Run:  pnpm tsx apps/desktop/src/renderer/components/world-map/bake-coastline.ts [110m|50m|10m]
 */

import { writeFile } from "node:fs/promises";
import { encodeCoastline } from "../../lib/coastline-codec.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Quantization is set per tier to just under the tier's own resolution, so it
 * only drops points the source never really resolved.
 *
 * `minExtentDegrees` is the speck cull, and it is the whole reason 10m is
 * affordable. 10m land is 5,848 polygons at full detail, which is within
 * sight of ticket 13's ~8,000-element SVG degradation threshold — but the
 * overwhelming majority are single uninhabited rocks. Culling by bounding-box
 * extent keeps the coastline resolution (the point of the tier) while
 * discarding subpaths that are sub-pixel at max zoom. 0.1° is ~11 km, which
 * still keeps every island this game names: Malta is ~0.25°, Gibraltar sits
 * on the Iberian polygon, Heligoland ~0.03° is gone and does not matter.
 */
const TIERS = {
  "110m": {
    url: "https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json",
    format: "topojson",
    quantize: 0.05,
    minExtentDegrees: 0,
  },
  "50m": {
    url: "https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json",
    format: "topojson",
    quantize: 0.02,
    minExtentDegrees: 0.05,
  },
  "10m": {
    url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson",
    format: "geojson",
    // ~1.1 km at the equator, which is about one device pixel at MAX_SCALE.
    // Finer than this is detail the camera can never show.
    quantize: 0.01,
    minExtentDegrees: 0.1,
  },
} as const satisfies Record<
  string,
  {
    url: string;
    format: "topojson" | "geojson";
    quantize: number;
    minExtentDegrees: number;
  }
>;

type TierId = keyof typeof TIERS;

const DEFAULT_TIER: TierId = "10m";

interface Topology {
  readonly transform: {
    readonly scale: readonly [number, number];
    readonly translate: readonly [number, number];
  };
  readonly arcs: readonly (readonly (readonly number[])[])[];
  readonly objects: {
    readonly land: {
      readonly geometries: readonly {
        readonly type: string;
        readonly arcs: readonly (readonly (readonly number[])[])[];
      }[];
    };
  };
}

type Ring = readonly (readonly [number, number])[];

function decodeArcs(topology: Topology): Ring[] {
  const [scaleX, scaleY] = topology.transform.scale;
  const [translateX, translateY] = topology.transform.translate;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map((delta) => {
      x += delta[0] ?? 0;
      y += delta[1] ?? 0;
      return [x * scaleX + translateX, y * scaleY + translateY] as const;
    });
  });
}

/** TopoJSON's negative index convention: ~i means arc -i-1, traversed backwards. */
function stitch(arcIndices: readonly number[], arcs: readonly Ring[]): Ring {
  const points: (readonly [number, number])[] = [];
  for (const index of arcIndices) {
    const arc = arcs[index < 0 ? -index - 1 : index];
    if (arc === undefined) continue;
    const oriented = index < 0 ? [...arc].reverse() : arc;
    // The shared endpoint between consecutive arcs is duplicated by design.
    points.push(...(points.length === 0 ? oriented : oriented.slice(1)));
  }
  return points;
}

/** GeoJSON FeatureCollection of Polygon/MultiPolygon, as ne_10m_land ships it. */
interface FeatureCollection {
  readonly features: readonly {
    readonly geometry: {
      readonly type: "Polygon" | "MultiPolygon";
      readonly coordinates: readonly unknown[];
    };
  }[];
}

/** Both formats converge here: a flat list of polygons, each a list of rings. */
function polygonsFromGeoJson(collection: FeatureCollection): Ring[][] {
  const polygons: Ring[][] = [];
  for (const feature of collection.features) {
    const { type, coordinates } = feature.geometry;
    const multi = (
      type === "Polygon" ? [coordinates] : coordinates
    ) as readonly (readonly Ring[])[];
    for (const rings of multi) polygons.push([...rings]);
  }
  return polygons;
}

function polygonsFromTopoJson(topology: Topology): Ring[][] {
  const arcs = decodeArcs(topology);
  const polygons: Ring[][] = [];
  for (const geometry of topology.objects.land.geometries) {
    // land-*m is a single MultiPolygon: polygon -> rings -> arc indices.
    for (const polygon of geometry.arcs) {
      polygons.push(polygon.map((ring) => stitch(ring as unknown as readonly number[], arcs)));
    }
  }
  return polygons;
}

function quantize(ring: Ring, step: number, decimals: number): number[] {
  const flat: number[] = [];
  let previousX: number | null = null;
  let previousY: number | null = null;
  for (const [lon, lat] of ring) {
    const x = Math.round(lon / step) * step;
    const y = Math.round(lat / step) * step;
    if (x === previousX && y === previousY) continue;
    flat.push(Number(x.toFixed(decimals)), Number(y.toFixed(decimals)));
    previousX = x;
    previousY = y;
  }
  return flat;
}

/** Larger side of a flat ring's bounding box, in degrees. */
function extentOf(flatRing: readonly number[]): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < flatRing.length; index += 2) {
    const x = flatRing[index] ?? 0;
    const y = flatRing[index + 1] ?? 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY);
}

async function main(): Promise<void> {
  const requested = process.argv[2] ?? DEFAULT_TIER;
  if (!(requested in TIERS))
    throw new Error(`unknown tier ${requested}; expected one of ${Object.keys(TIERS).join(", ")}`);
  const tier = TIERS[requested as TierId];
  const decimals = Math.max(0, -Math.floor(Math.log10(tier.quantize)));

  const response = await fetch(tier.url);
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
  const source: unknown = await response.json();

  const raw =
    tier.format === "topojson"
      ? polygonsFromTopoJson(source as Topology)
      : polygonsFromGeoJson(source as FeatureCollection);

  const polygons: number[][][] = [];
  for (const ringsIn of raw) {
    const rings = ringsIn.map((ring) => quantize(ring, tier.quantize, decimals));
    const exterior = rings[0];
    // Ring 0 is the exterior; a polygon too small to draw takes its holes with it.
    if (exterior === undefined || exterior.length < 6) continue;
    if (extentOf(exterior) < tier.minExtentDegrees) continue;
    polygons.push(rings);
  }

  const pointCount = polygons.reduce(
    (total, rings) => total + rings.reduce((sum, ring) => sum + ring.length / 2, 0),
    0,
  );

  // Compact binary, base64'd into a module: 4x smaller than the old number-array
  // literal and far cheaper to parse (ADR-0055).
  const target = join(dirname(fileURLToPath(import.meta.url)), "coastline-data.ts");
  const base64 = Buffer.from(encodeCoastline(polygons)).toString("base64");
  const output = `/**
 * GENERATED by ./bake-coastline.ts. Do not edit.
 *
 * Natural Earth 1:${requested} land (public domain), encoded with lib/coastline-codec.ts
 * and base64'd (a string literal parses far faster than the number-array literal
 * it replaces; the build's \`?inline\` does not support binary assets).
 * ${polygons.length} polygons, ${pointCount} points, quantized to ${tier.quantize} degrees.
 */

export const COASTLINE_BASE64 =
  "${base64}";
`;
  await writeFile(target, output, "utf8");
  process.stdout.write(`wrote ${target}\n${polygons.length} polygons, ${pointCount} points\n`);
}

await main();
