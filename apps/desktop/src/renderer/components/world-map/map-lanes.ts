import type { Point } from "./projection.js";

export interface LaneMark {
  readonly id: string;
  readonly from: Point;
  readonly to: Point;
}

export interface LaneEdge {
  readonly a: string;
  readonly b: string;
}

export function buildLanes(
  edges: readonly LaneEdge[],
  anchorOf: ReadonlyMap<string, Point>,
  worldWidth: number,
): LaneMark[] {
  const lanes = new Map<string, LaneMark>();
  for (const edge of edges) {
    const [first, second] = edge.a < edge.b ? [edge.a, edge.b] : [edge.b, edge.a];
    const id = `${first}~${second}`;
    if (lanes.has(id)) continue;
    const from = anchorOf.get(first);
    const target = anchorOf.get(second);
    if (from === undefined || target === undefined) continue;
    let toX = target[0];
    if (toX - from[0] > worldWidth / 2) toX -= worldWidth;
    else if (from[0] - toX > worldWidth / 2) toX += worldWidth;
    lanes.set(id, { id, from, to: [toX, target[1]] });
  }
  return [...lanes.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
