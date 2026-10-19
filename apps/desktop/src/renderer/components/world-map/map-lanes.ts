/**
 * Passive sea lanes: a line between every pair of connected areas. Pure.
 *
 * The connections are the same `EDGES` graph the route reading searches
 * (`routeBetween`), so what the chart draws and what a route can follow are one
 * graph, not two. A lane is geometry only — it carries no route, distance or
 * hop count; a measured route is a separate layer.
 *
 * Gated edges (a strait or canal) are left to the passage layer, which styles
 * an open gate differently from a closed one.
 */

import type { PrototypeEdge } from "./fixture-world.js";
import type { Point } from "./projection.js";

export interface LaneMark {
  /** The two area ids in codepoint order, joined with `~`. */
  readonly id: string;
  readonly from: Point;
  readonly to: Point;
}

/**
 * Lanes for every ungated edge whose two areas both have an anchor, ordered by
 * id. `worldWidth` lets a lane that crosses the antimeridian take the short way
 * round: the chart draws a copy of the world at ±width, so a line running past
 * the edge continues into the neighbouring copy.
 */
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
