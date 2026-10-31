import type { Point } from "./projection.js";

export interface LaneMark {
  readonly id: string;
  readonly from: Point;
  readonly to: Point;
  readonly via?: readonly Point[];
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

export interface SeaLanePath {
  readonly id: string;
  readonly path: readonly Point[];
}

export function projectContinuousPath(
  path: readonly Point[],
  locate: (lonLat: Point) => Point,
  worldWidth: number,
): Point[] {
  const projected: Point[] = [];
  for (const lonLat of path) {
    const [x, y] = locate(lonLat);
    const previous = projected[projected.length - 1];
    let unwrapped = x;
    if (previous !== undefined) {
      while (unwrapped - previous[0] > worldWidth / 2) unwrapped -= worldWidth;
      while (previous[0] - unwrapped > worldWidth / 2) unwrapped += worldWidth;
    }
    projected.push([unwrapped, y]);
  }
  return projected;
}

export function buildSeaLanes(
  seaLanes: readonly SeaLanePath[],
  locate: (lonLat: Point) => Point,
  worldWidth: number,
): LaneMark[] {
  const marks: LaneMark[] = [];
  for (const lane of seaLanes) {
    if (lane.path.length < 2) continue;
    const projected = projectContinuousPath(lane.path, locate, worldWidth);
    const from = projected[0] as Point;
    const to = projected[projected.length - 1] as Point;
    marks.push({ id: lane.id, from, to, via: projected.slice(1, -1) });
  }
  return marks.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
