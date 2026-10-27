export type Point = readonly [number, number];

export type ProjectionId = "equirectangular" | "miller";

export interface Projection {
  readonly id: ProjectionId;
  readonly name: string;
  readonly note: string;
  readonly width: number;
  readonly height: number;
  readonly project: (lon: number, lat: number) => Point;
}

const WORLD_WIDTH = 2000;

const DEGREES = Math.PI / 180;

function asinh(value: number): number {
  return Math.log(value + Math.sqrt(value * value + 1));
}

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

export function wrapLongitude(lon: number, centre: number): number {
  return ((((lon - centre + 180) % 360) + 360) % 360) - 180;
}

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

export const WORLD_WRAP_TURNS: readonly number[] = [-1, 0, 1];

export interface ProjectedArea {
  readonly id: string;
  readonly path: string;
  readonly ring: readonly Point[];
  readonly label: Point;
  readonly centroid: Point;
  readonly bounds: { readonly width: number; readonly height: number };
}

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
      ring: ring.map((point: Point) => projection.project(point[0], point[1])),
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
