import type { TerrainVertex } from "@bluewave/content-schema";

export type Vertices = readonly TerrainVertex[];

function orientation(a: TerrainVertex, b: TerrainVertex, c: TerrainVertex): number {
  const cross = (b.xM - a.xM) * (c.yM - a.yM) - (b.yM - a.yM) * (c.xM - a.xM);
  return cross > 0 ? 1 : cross < 0 ? -1 : 0;
}

function onSegment(a: TerrainVertex, b: TerrainVertex, p: TerrainVertex): boolean {
  return (
    orientation(a, b, p) === 0 &&
    p.xM >= Math.min(a.xM, b.xM) &&
    p.xM <= Math.max(a.xM, b.xM) &&
    p.yM >= Math.min(a.yM, b.yM) &&
    p.yM <= Math.max(a.yM, b.yM)
  );
}

function segmentsIntersect(
  p: TerrainVertex,
  q: TerrainVertex,
  a: TerrainVertex,
  b: TerrainVertex,
): boolean {
  if (
    orientation(p, q, a) !== orientation(p, q, b) &&
    orientation(a, b, p) !== orientation(a, b, q)
  )
    return true;
  return onSegment(p, q, a) || onSegment(p, q, b) || onSegment(a, b, p) || onSegment(a, b, q);
}

function segmentsCross(
  p: TerrainVertex,
  q: TerrainVertex,
  a: TerrainVertex,
  b: TerrainVertex,
): boolean {
  const o1 = orientation(p, q, a);
  const o2 = orientation(p, q, b);
  const o3 = orientation(a, b, p);
  const o4 = orientation(a, b, q);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function signedArea2(vertices: Vertices): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i] as TerrainVertex;
    const b = vertices[(i + 1) % vertices.length] as TerrainVertex;
    sum += a.xM * b.yM - b.xM * a.yM;
  }
  return sum;
}

export function selfIntersection(vertices: Vertices): string | undefined {
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const a = vertices[i] as TerrainVertex;
    const b = vertices[(i + 1) % n] as TerrainVertex;
    if (a.xM === b.xM && a.yM === b.yM) return `edge ${i} has zero length`;
  }
  for (let i = 0; i < n; i += 1) {
    const a = vertices[i] as TerrainVertex;
    const b = vertices[(i + 1) % n] as TerrainVertex;
    const c = vertices[(i + 2) % n] as TerrainVertex;
    const foldsBack =
      orientation(a, b, c) === 0 &&
      (a.xM - b.xM) * (c.xM - b.xM) + (a.yM - b.yM) * (c.yM - b.yM) > 0;
    if (foldsBack) return `edges ${i} and ${(i + 1) % n} fold back on each other`;
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      const d = vertices[j] as TerrainVertex;
      const e = vertices[(j + 1) % n] as TerrainVertex;
      if (segmentsIntersect(a, b, d, e)) return `edges ${i} and ${j} intersect`;
    }
  }
  return undefined;
}

function strictlyInside(point: TerrainVertex, vertices: Vertices): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const a = vertices[i] as TerrainVertex;
    const b = vertices[(i + 1) % n] as TerrainVertex;
    if (onSegment(a, b, point)) return false;
    if (a.yM > point.yM !== b.yM > point.yM) {
      const side = (b.xM - a.xM) * (point.yM - a.yM) - (point.xM - a.xM) * (b.yM - a.yM);
      if (b.yM > a.yM ? side > 0 : side < 0) inside = !inside;
    }
  }
  return inside;
}

function doubled(vertices: Vertices): TerrainVertex[] {
  return vertices.map((v) => ({ xM: v.xM * 2, yM: v.yM * 2 }));
}

function samplePoints(vertices: Vertices): TerrainVertex[] {
  const n = vertices.length;
  const points = doubled(vertices);
  for (let i = 0; i < n; i += 1) {
    const a = vertices[i] as TerrainVertex;
    const b = vertices[(i + 1) % n] as TerrainVertex;
    points.push({ xM: a.xM + b.xM, yM: a.yM + b.yM });
  }
  return points;
}

function sameVertexSet(a: Vertices, b: Vertices): boolean {
  if (a.length !== b.length) return false;
  const key = (v: TerrainVertex) => `${v.xM},${v.yM}`;
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.every((value, index) => value === right[index]);
}

export function interiorsOverlap(a: Vertices, b: Vertices): boolean {
  if (sameVertexSet(a, b)) return true;
  for (let i = 0; i < a.length; i += 1) {
    const p = a[i] as TerrainVertex;
    const q = a[(i + 1) % a.length] as TerrainVertex;
    for (let j = 0; j < b.length; j += 1) {
      if (segmentsCross(p, q, b[j] as TerrainVertex, b[(j + 1) % b.length] as TerrainVertex))
        return true;
    }
  }
  const doubledA = doubled(a);
  const doubledB = doubled(b);
  return (
    samplePoints(a).some((point) => strictlyInside(point, doubledB)) ||
    samplePoints(b).some((point) => strictlyInside(point, doubledA))
  );
}
