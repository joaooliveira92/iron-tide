import type { Position } from "./geodesy.ts";

export function toWorld(position: Position): readonly [number, number] {
  const sine = Math.sin(
    (Math.max(-85.0511287798066, Math.min(85.0511287798066, position[1])) * Math.PI) / 180,
  );
  return [(position[0] + 180) / 360, 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)];
}

function segmentDistanceSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  return ex * ex + ey * ey;
}

export function simplifyRing(
  ring: readonly Position[],
  pinned: readonly boolean[],
  toleranceWorld: number,
): readonly Position[] {
  const world = ring.map(toWorld);
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  pinned.forEach((flag, index) => {
    if (flag) keep[index] = 1;
  });
  const toleranceSquared = toleranceWorld * toleranceWorld;
  const stack: [number, number][] = [[0, ring.length - 1]];
  const anchors: number[] = [];
  for (let index = 0; index < ring.length; index++) if (keep[index] === 1) anchors.push(index);
  stack.length = 0;
  for (let index = 0; index + 1 < anchors.length; index++) {
    stack.push([anchors[index] as number, anchors[index + 1] as number]);
  }
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    if (last - first < 2) continue;
    const [ax, ay] = world[first] as readonly [number, number];
    const [bx, by] = world[last] as readonly [number, number];
    let worst = -1;
    let worstIndex = -1;
    for (let index = first + 1; index < last; index++) {
      const [px, py] = world[index] as readonly [number, number];
      const distance = segmentDistanceSquared(px, py, ax, ay, bx, by);
      if (distance > worst) {
        worst = distance;
        worstIndex = index;
      }
    }
    if (worst > toleranceSquared) {
      keep[worstIndex] = 1;
      stack.push([first, worstIndex], [worstIndex, last]);
    }
  }
  const out: Position[] = [];
  for (let index = 0; index < ring.length; index++) {
    if (keep[index] === 1) out.push(ring[index] as Position);
  }
  return out;
}

export function ringExtentWorld(ring: readonly Position[]): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of ring) {
    const [x, y] = toWorld(point);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return Math.max(maxX - minX, maxY - minY);
}
