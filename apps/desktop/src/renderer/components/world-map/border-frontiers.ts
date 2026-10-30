import type { FlatPolygon, FlatRing } from "../../lib/simplify-geometry.js";

export const BORDER_COAST_TOLERANCE = 0.05;

interface Segment {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
}

interface CoastIndex {
  readonly cellSize: number;
  readonly cells: ReadonlyMap<string, readonly Segment[]>;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function buildCoastIndex(coast: readonly FlatPolygon[], cellSize: number): CoastIndex {
  const cells = new Map<string, Segment[]>();
  for (const rings of coast) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const j = (i + 2) % ring.length;
        const segment: Segment = {
          ax: ring[i] as number,
          ay: ring[i + 1] as number,
          bx: ring[j] as number,
          by: ring[j + 1] as number,
        };
        const minX = Math.floor(Math.min(segment.ax, segment.bx) / cellSize);
        const maxX = Math.floor(Math.max(segment.ax, segment.bx) / cellSize);
        const minY = Math.floor(Math.min(segment.ay, segment.by) / cellSize);
        const maxY = Math.floor(Math.max(segment.ay, segment.by) / cellSize);
        for (let x = minX; x <= maxX; x++) {
          for (let y = minY; y <= maxY; y++) {
            const key = cellKey(x, y);
            const bucket = cells.get(key);
            if (bucket === undefined) cells.set(key, [segment]);
            else bucket.push(segment);
          }
        }
      }
    }
  }
  return { cellSize, cells };
}

function segmentDistance(px: number, py: number, segment: Segment): number {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const lengthSq = dx * dx + dy * dy;
  const t =
    lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - segment.ax) * dx + (py - segment.ay) * dy) / lengthSq));
  return Math.hypot(px - (segment.ax + t * dx), py - (segment.ay + t * dy));
}

function distanceToCoast(x: number, y: number, index: CoastIndex): number {
  const cx = Math.floor(x / index.cellSize);
  const cy = Math.floor(y / index.cellSize);
  let best = Infinity;
  for (let gx = cx - 1; gx <= cx + 1; gx++) {
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      const bucket = index.cells.get(cellKey(gx, gy));
      if (bucket === undefined) continue;
      for (const segment of bucket) {
        const distance = segmentDistance(x, y, segment);
        if (distance < best) best = distance;
      }
    }
  }
  return best;
}

function closeLine(ring: FlatRing): number[] {
  const line = [...ring];
  const firstX = ring[0];
  const firstY = ring[1];
  const lastX = ring[ring.length - 2];
  const lastY = ring[ring.length - 1];
  if (firstX !== lastX || firstY !== lastY) line.push(firstX as number, firstY as number);
  return line;
}

function frontierRuns(ring: FlatRing, index: CoastIndex, tolerance: number): FlatRing[] {
  const count = ring.length / 2;
  if (count < 2) return [];
  const onCoast: boolean[] = [];
  let coastCount = 0;
  for (let i = 0; i < count; i++) {
    const near =
      distanceToCoast(ring[i * 2] as number, ring[i * 2 + 1] as number, index) < tolerance;
    onCoast.push(near);
    if (near) coastCount++;
  }
  if (coastCount === count) return [];
  if (coastCount === 0) return [closeLine(ring)];

  const runs: FlatRing[] = [];
  const start = onCoast.findIndex((near) => !near);
  let run: number[] = [];
  for (let step = 0; step < count; step++) {
    const i = (start + step) % count;
    if (onCoast[i] !== true) {
      run.push(ring[i * 2] as number, ring[i * 2 + 1] as number);
    } else if (run.length > 0) {
      if (run.length >= 4) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 4) runs.push(run);
  return runs;
}

export function deriveBorderFrontiers(
  borders: Readonly<Record<string, readonly FlatPolygon[]>>,
  coast: readonly FlatPolygon[],
  tolerance: number = BORDER_COAST_TOLERANCE,
): Readonly<Record<string, readonly FlatRing[]>> {
  const index = buildCoastIndex(coast, Math.max(tolerance * 4, 0.25));
  const result: Record<string, readonly FlatRing[]> = {};
  for (const [nation, polygons] of Object.entries(borders)) {
    const lines: FlatRing[] = [];
    for (const rings of polygons) {
      for (const ring of rings) {
        lines.push(...frontierRuns(ring, index, tolerance));
      }
    }
    result[nation] = lines;
  }
  return result;
}
