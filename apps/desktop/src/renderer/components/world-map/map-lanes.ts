import type { PrototypeEdge } from "./fixture-world.js";
import type { Point } from "./projection.js";

export interface LaneMark {
  readonly id: string;
  readonly from: Point;
  readonly to: Point;
}

export function laneEdges(
  campaign: readonly { readonly a: string; readonly b: string }[] | null,
  fixture: readonly PrototypeEdge[],
): readonly PrototypeEdge[] {
  if (campaign === null) return fixture;
  const gates = new Map<string, string>();
  for (const edge of fixture) {
    if (edge.passage !== undefined) gates.set([edge.a, edge.b].sort().join("~"), edge.passage);
  }
  return campaign.map((lane) => {
    const passage = gates.get([lane.a, lane.b].sort().join("~"));
    return passage === undefined ? { a: lane.a, b: lane.b } : { a: lane.a, b: lane.b, passage };
  });
}

export function buildLanes(
  edges: readonly PrototypeEdge[],
  anchorOf: ReadonlyMap<string, Point>,
  worldWidth: number,
): LaneMark[] {
  const lanes = new Map<string, LaneMark>();
  for (const edge of edges) {
    if (edge.passage !== undefined) continue;
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
