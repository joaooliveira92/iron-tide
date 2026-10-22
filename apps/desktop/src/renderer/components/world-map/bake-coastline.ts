import { writeFile } from "node:fs/promises";
import { encodeCoastline } from "../../lib/coastline-codec.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

function stitch(arcIndices: readonly number[], arcs: readonly Ring[]): Ring {
  const points: (readonly [number, number])[] = [];
  for (const index of arcIndices) {
    const arc = arcs[index < 0 ? -index - 1 : index];
    if (arc === undefined) continue;
    const oriented = index < 0 ? [...arc].reverse() : arc;
    points.push(...(points.length === 0 ? oriented : oriented.slice(1)));
  }
  return points;
}

interface FeatureCollection {
  readonly features: readonly {
    readonly geometry: {
      readonly type: "Polygon" | "MultiPolygon";
      readonly coordinates: readonly unknown[];
    };
  }[];
}

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
    if (exterior === undefined || exterior.length < 6) continue;
    if (extentOf(exterior) < tier.minExtentDegrees) continue;
    polygons.push(rings);
  }

  const pointCount = polygons.reduce(
    (total, rings) => total + rings.reduce((sum, ring) => sum + ring.length / 2, 0),
    0,
  );

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
