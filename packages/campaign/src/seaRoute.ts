import { isSeaArea } from "./seaArea.js";
import type { WorldState } from "./state.js";

export type SeaAdjacency = ReadonlyMap<string, readonly string[]>;

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function seaAdjacency(world: Pick<WorldState, "areas" | "routes">): SeaAdjacency {
  const sea = new Set(world.areas.filter(isSeaArea).map((a) => a.id));
  const adjacency = new Map<string, string[]>();
  const link = (from: string, to: string): void => {
    if (!sea.has(from) || !sea.has(to)) return;
    const list = adjacency.get(from) ?? [];
    if (!list.includes(to)) list.push(to);
    adjacency.set(from, list);
  };
  for (const route of world.routes) {
    if (route.type !== "sea") continue;
    link(route.from, route.to);
    link(route.to, route.from);
  }
  for (const list of adjacency.values()) list.sort(byId);
  return adjacency;
}

function hopsFrom(target: string, adjacency: SeaAdjacency): Map<string, number> {
  const distance = new Map<string, number>([[target, 0]]);
  const queue = [target];
  for (let i = 0; i < queue.length; i += 1) {
    const here = queue[i]!;
    for (const next of adjacency.get(here) ?? []) {
      if (distance.has(next)) continue;
      distance.set(next, distance.get(here)! + 1);
      queue.push(next);
    }
  }
  return distance;
}

export function nextHopToward(
  from: string,
  target: string,
  adjacency: SeaAdjacency,
): string | null {
  const distance = hopsFrom(target, adjacency);
  const here = distance.get(from);
  if (here === undefined || here === 0) return null;
  return (adjacency.get(from) ?? []).find((n) => distance.get(n) === here - 1) ?? null;
}

export function seaRoute(
  world: Pick<WorldState, "areas" | "routes">,
  from: string,
  to: string,
): readonly string[] | null {
  if (from === to) return [];
  const adjacency = seaAdjacency(world);
  const distance = hopsFrom(to, adjacency);
  if (!distance.has(from)) return null;
  const path: string[] = [];
  let here = from;
  while (here !== to) {
    const hops = distance.get(here)!;
    const next = (adjacency.get(here) ?? []).find((n) => distance.get(n) === hops - 1);
    if (next === undefined) return null;
    path.push(next);
    here = next;
  }
  return path;
}
