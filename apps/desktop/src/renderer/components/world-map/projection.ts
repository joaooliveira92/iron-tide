/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Pure geometry. No React, no DOM. This is the part of the prototype most
 * likely to survive into real code, so it is kept honest.
 *
 * Two decisions are encoded here and both are ticket 06 questions:
 *
 * 1. **Projection is applied at render time, not author time.** The baked
 *    coastline is unprojected lon/lat, so switching projection is a `useMemo`
 *    recompute over ~5k points rather than a rebuild. That only works because
 *    TopoJSON made the source small enough; at 10m resolution it would not.
 *
 * 2. **The antimeridian is handled by drawing the world three times** — at
 *    -1, 0 and +1 turns — and letting the SVG viewport clip. No polygon
 *    clipping code, no RFC 7946 splitting, and rings may be authored in
 *    continuous longitude past 180.
 *
 *    Every layer gets all three copies, markers and labels included. Drawing
 *    the polygons three times and the labels once was the first thing this
 *    prototype got wrong, and it looked exactly like a projection bug. The
 *    cost of doing it properly is a 3x element count — about 760 nodes for
 *    this world, an order of magnitude under the ~8,000 where ticket 13's
 *    research saw SVG start to degrade.
 */

export type Point = readonly [number, number];

export type ProjectionId = "equirectangular" | "miller";

export interface Projection {
  readonly id: ProjectionId;
  readonly name: string;
  readonly note: string;
  /** World-space width. Height falls out of the projection's own y-extent. */
  readonly width: number;
  readonly height: number;
  readonly project: (lon: number, lat: number) => Point;
}

const WORLD_WIDTH = 2000;

const DEGREES = Math.PI / 180;

function asinh(value: number): number {
  return Math.log(value + Math.sqrt(value * value + 1));
}

/** Miller's y, in radians of the unit sphere. */
function millerY(latDegrees: number): number {
  return 1.25 * asinh(Math.tan(0.8 * latDegrees * DEGREES));
}

const MILLER_SCALE = WORLD_WIDTH / 360;
const MILLER_HALF_HEIGHT = (millerY(90) / DEGREES) * MILLER_SCALE;

export const PROJECTIONS: readonly Projection[] = [
  {
    id: "equirectangular",
    name: "Equirectangular",
    note: "Latitude spacing is even. High-latitude areas are stretched sideways — the Barents looks three times its width.",
    width: WORLD_WIDTH,
    height: WORLD_WIDTH / 2,
    project: (lon, lat) => [(lon + 180) * (WORLD_WIDTH / 360), (90 - lat) * (WORLD_WIDTH / 360)],
  },
  {
    id: "miller",
    name: "Miller cylindrical",
    note: "Stretches vertically to compensate for the sideways stretch, so Arctic areas keep their shape. Costs 45% more vertical canvas.",
    width: WORLD_WIDTH,
    height: MILLER_HALF_HEIGHT * 2,
    project: (lon, lat) => [
      (lon + 180) * (WORLD_WIDTH / 360),
      MILLER_HALF_HEIGHT - (millerY(lat) / DEGREES) * MILLER_SCALE,
    ],
  },
];

export function projectionById(id: ProjectionId): Projection {
  return PROJECTIONS.find((p) => p.id === id) ?? (PROJECTIONS[0] as Projection);
}

/** Wraps a longitude into [-180, 180) after rotating the map by `centre`. */
export function wrapLongitude(lon: number, centre: number): number {
  return ((((lon - centre + 180) % 360) + 360) % 360) - 180;
}

/**
 * Rotates a ring and keeps it geometrically continuous: each vertex is nudged
 * by whole turns so no segment ever jumps more than half the world. The result
 * can sit outside [-180, 180); the three-copy draw below is what puts it back
 * on screen.
 */
export function continuousRing(ring: readonly Point[], centre: number): readonly Point[] {
  const out: Point[] = [];
  let previous: number | null = null;
  for (const [lon, lat] of ring) {
    let value = wrapLongitude(lon, centre);
    if (previous !== null) {
      while (value - previous > 180) value -= 360;
      while (previous - value > 180) value += 360;
    }
    previous = value;
    out.push([value, lat]);
  }
  return out;
}

export function ringToPath(ring: readonly Point[], projection: Projection): string {
  let path = "";
  for (let i = 0; i < ring.length; i += 1) {
    const vertex = ring[i];
    if (vertex === undefined) continue;
    const [x, y] = projection.project(vertex[0], vertex[1]);
    path += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${path}Z`;
}

/**
 * Whole-turn offsets, in world widths. A variant renders its entire content
 * once per entry inside a translated <g>, which is what makes the seam vanish.
 */
export const WORLD_WRAP_TURNS: readonly number[] = [-1, 0, 1];

export interface ProjectedArea {
  readonly id: string;
  readonly path: string;
  /** Wrapped-into-range anchor for the hand-placed label. */
  readonly label: Point;
  /** Wrapped-into-range anchor computed from the ring, for comparison. */
  readonly centroid: Point;
  readonly bounds: { readonly width: number; readonly height: number };
}

/** Area-weighted polygon centroid; falls back to the mean for degenerate rings. */
export function ringCentroid(ring: readonly Point[]): Point {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    if (current === undefined || next === undefined) continue;
    const cross = current[0] * next[1] - next[0] * current[1];
    twiceArea += cross;
    x += (current[0] + next[0]) * cross;
    y += (current[1] + next[1]) * cross;
  }
  if (Math.abs(twiceArea) < 1e-9) {
    const sum = ring.reduce<Point>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  }
  return [x / (3 * twiceArea), y / (3 * twiceArea)];
}

export interface AreaGeometryInput {
  readonly id: string;
  readonly ring: readonly Point[];
  readonly label: Point;
}

export function projectAreas(
  areas: readonly AreaGeometryInput[],
  projection: Projection,
  centre: number,
): readonly ProjectedArea[] {
  return areas.map((area) => {
    const ring = continuousRing(area.ring, centre);
    const centroidLonLat = ringCentroid(ring);
    const xs = ring.map((p) => projection.project(p[0], p[1])[0]);
    const ys = ring.map((p) => projection.project(p[0], p[1])[1]);
    return {
      id: area.id,
      path: ringToPath(ring, projection),
      label: projection.project(wrapLongitude(area.label[0], centre), area.label[1]),
      centroid: projection.project(centroidLonLat[0], centroidLonLat[1]),
      bounds: {
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      },
    };
  });
}

export function projectPoint(point: Point, projection: Projection, centre: number): Point {
  return projection.project(wrapLongitude(point[0], centre), point[1]);
}

/**
 * Great-circle distance in nautical miles. Here so the route ruler can report
 * a real number, which is how ticket 01's "one edge is one ~3,000 nm leg"
 * claim gets checked against an actual graph instead of asserted.
 */
export function nauticalMiles(from: Point, to: Point): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const dLat = (lat2 - lat1) * DEGREES;
  const dLon = (lon2 - lon1) * DEGREES;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEGREES) * Math.cos(lat2 * DEGREES) * Math.sin(dLon / 2) ** 2;
  return 3440.065 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
