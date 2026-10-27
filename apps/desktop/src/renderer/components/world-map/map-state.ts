import { AREAS_BY_ID, type AreaId, type NationId } from "./map-geometry.js";
import { nauticalMiles, type ProjectionId } from "./projection.js";

export interface AreaControl {
  readonly owner: NationId | null;
  readonly contested: boolean;
  readonly possessions: number;
}

export type LayerId =
  | "ownership"
  | "borders"
  | "lanes"
  | "possessions"
  | "fleets"
  | "labels"
  | "routes";

export const LAYERS: readonly { id: LayerId; label: string }[] = [
  { id: "ownership", label: "Ownership" },
  { id: "borders", label: "1880 borders" },
  { id: "lanes", label: "Sea lanes" },
  { id: "possessions", label: "Possessions" },
  { id: "fleets", label: "Fleets" },
  { id: "routes", label: "Routes" },
  { id: "labels", label: "Labels" },
];

export interface MapPrototypeState {
  readonly selected: AreaId | null;
  readonly rulerFrom: AreaId | null;
  readonly rulerTo: AreaId | null;
  readonly layers: Readonly<Record<LayerId, boolean>>;
  readonly projection: ProjectionId;
  readonly centre: number;
}

export const initialMapPrototypeState: MapPrototypeState = {
  selected: null,
  rulerFrom: null,
  rulerTo: null,
  layers: {
    ownership: true,
    borders: true,
    lanes: true,
    possessions: true,
    fleets: true,
    labels: true,
    routes: true,
  },
  projection: "miller",
  centre: 0,
};

export function selectArea(state: MapPrototypeState, area: AreaId | null): MapPrototypeState {
  return { ...state, selected: state.selected === area ? null : area };
}

export function pushRuler(state: MapPrototypeState, area: AreaId): MapPrototypeState {
  if (state.rulerFrom === null || state.rulerTo !== null) {
    return { ...state, rulerFrom: area, rulerTo: null };
  }
  return { ...state, rulerTo: area };
}

export function toggleLayer(state: MapPrototypeState, layer: LayerId): MapPrototypeState {
  return {
    ...state,
    layers: { ...state.layers, [layer]: !state.layers[layer] },
  };
}

export interface RouteLane {
  readonly a: AreaId;
  readonly b: AreaId;
}

export interface RouteReading {
  readonly path: readonly AreaId[];
  readonly hops: number;
  readonly nauticalMiles: number;
  readonly perHop: number;
  readonly months: number;
}

function neighboursOf(lanes: readonly RouteLane[]): ReadonlyMap<AreaId, readonly AreaId[]> {
  const neighbours = new Map<AreaId, AreaId[]>();
  for (const lane of lanes) {
    if (lane.a === lane.b) continue;
    for (const [from, to] of [
      [lane.a, lane.b],
      [lane.b, lane.a],
    ] as const) {
      const list = neighbours.get(from) ?? [];
      if (!list.includes(to)) list.push(to);
      neighbours.set(from, list);
    }
  }
  for (const list of neighbours.values()) list.sort((left, right) => (left < right ? -1 : 1));
  return neighbours;
}

export function readRoute(
  state: MapPrototypeState,
  lanes: readonly RouteLane[],
): RouteReading | null {
  if (state.rulerFrom === null || state.rulerTo === null) return null;
  if (state.rulerFrom === state.rulerTo) return null;
  const neighbours = neighboursOf(lanes);
  const previous = new Map<AreaId, AreaId | null>([[state.rulerFrom, null]]);
  const queue: AreaId[] = [state.rulerFrom];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    if (current === state.rulerTo) {
      const path: AreaId[] = [];
      let cursor: AreaId | null | undefined = current;
      while (cursor !== null && cursor !== undefined) {
        path.unshift(cursor);
        cursor = previous.get(cursor);
      }
      return routeReading(path);
    }
    for (const next of neighbours.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  return null;
}

function routeReading(path: readonly AreaId[]): RouteReading | null {
  if (path.length < 2) return null;
  let distance = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = AREAS_BY_ID.get(path[i] as AreaId);
    const to = AREAS_BY_ID.get(path[i + 1] as AreaId);
    if (from === undefined || to === undefined) return null;
    distance += nauticalMiles(from.label, to.label);
  }
  const hops = path.length - 1;
  return {
    path,
    hops,
    nauticalMiles: Math.round(distance),
    perHop: Math.round(distance / hops),
    months: Math.round((distance / 3100) * 10) / 10,
  };
}

export interface AreaSummary {
  readonly id: AreaId;
  readonly name: string;
  readonly control: AreaControl;
  readonly possessions: readonly {
    id: string;
    name: string;
    owner: NationId;
  }[];
  readonly fleets: readonly {
    id: string;
    name: string;
    owner: NationId;
    ships: number;
  }[];
  readonly neighbours: readonly {
    id: AreaId;
    name: string;
  }[];
}
