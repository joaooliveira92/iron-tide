import type { Point } from "./projection.js";

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

function insideRing(ring: readonly Point[], point: MapPoint): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const current = ring[index];
    const before = ring[previous];
    if (current === undefined || before === undefined) continue;
    const [x, y] = current;
    const [px, py] = before;
    const crosses = y > point.y !== py > point.y;
    if (crosses && point.x < ((px - x) * (point.y - y)) / (py - y) + x) inside = !inside;
  }
  return inside;
}

export interface HitTestArea {
  readonly id: string;
  readonly ring: readonly Point[];
  readonly label: Point;
}

export function areaAtPoint(
  areas: readonly HitTestArea[],
  point: MapPoint,
  worldWidth: number,
): string | null {
  const candidates: { area: HitTestArea; distance: number }[] = [];
  for (const area of areas) {
    for (const offset of [0, worldWidth, -worldWidth]) {
      const shifted = { x: point.x + offset, y: point.y };
      if (!insideRing(area.ring, shifted)) continue;
      const [lx, ly] = area.label;
      candidates.push({
        area,
        distance: Math.hypot(lx - shifted.x, ly - shifted.y) + Math.abs(offset) / worldWidth,
      });
      break;
    }
  }
  candidates.sort((left, right) => {
    if (left.distance !== right.distance) return left.distance - right.distance;
    return left.area.id < right.area.id ? -1 : left.area.id > right.area.id ? 1 : 0;
  });
  return candidates[0]?.area.id ?? null;
}
