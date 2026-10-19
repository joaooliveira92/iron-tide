/**
 * The state the three variants share. Deliberately only *data* is shared —
 * selection, the ruler, layer toggles, the derived route. Layout, information
 * hierarchy, and every visual decision belong to the variants, because that is
 * the thing being compared.
 */

import {
  AREAS,
  AREAS_BY_ID,
  EDGES,
  FLEETS,
  NATIONS_BY_ID,
  PASSAGES_BY_ID,
  POSSESSIONS,
  deriveAreaControl,
  routeBetween,
  type AreaControl,
  type AreaId,
  type NationId,
} from "./fixture-world.js";
import { nauticalMiles, type ProjectionId } from "./projection.js";

export type LayerId =
  | "ownership"
  | "borders"
  | "passages"
  | "possessions"
  | "fleets"
  | "labels"
  | "routes";

export const LAYERS: readonly { id: LayerId; label: string }[] = [
  { id: "ownership", label: "Ownership" },
  { id: "borders", label: "1880 borders" },
  { id: "passages", label: "Passages" },
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
  readonly respectClosedPassages: boolean;
}

export const initialMapPrototypeState: MapPrototypeState = {
  selected: null,
  rulerFrom: null,
  rulerTo: null,
  layers: {
    ownership: true,
    borders: true,
    passages: true,
    possessions: true,
    fleets: true,
    labels: true,
    routes: true,
  },
  projection: "miller",
  centre: 0,
  respectClosedPassages: true,
};

export function selectArea(state: MapPrototypeState, area: AreaId | null): MapPrototypeState {
  return { ...state, selected: state.selected === area ? null : area };
}

/** Clicking with the ruler active sets `from`, then `to`, then starts over. */
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

export interface RouteReading {
  readonly path: readonly AreaId[];
  readonly hops: number;
  readonly nauticalMiles: number;
  readonly perHop: number;
  readonly passages: readonly string[];
  /** Months at ticket 12's measured 3,100 nm rate of advance. */
  readonly months: number;
}

export function readRoute(state: MapPrototypeState): RouteReading | null {
  if (state.rulerFrom === null || state.rulerTo === null) return null;
  const path = routeBetween(state.rulerFrom, state.rulerTo, {
    avoidClosedPassages: state.respectClosedPassages,
  });
  if (path === null || path.length < 2) return null;

  let distance = 0;
  const passages: string[] = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = AREAS_BY_ID.get(path[i] as AreaId);
    const to = AREAS_BY_ID.get(path[i + 1] as AreaId);
    if (from === undefined || to === undefined) continue;
    distance += nauticalMiles(from.label, to.label);
    const edge = EDGES.find(
      (candidate) =>
        (candidate.a === from.id && candidate.b === to.id) ||
        (candidate.a === to.id && candidate.b === from.id),
    );
    if (edge?.passage !== undefined) {
      const passage = PASSAGES_BY_ID.get(edge.passage);
      if (passage !== undefined) passages.push(passage.name);
    }
  }
  const hops = path.length - 1;
  return {
    path,
    hops,
    nauticalMiles: Math.round(distance),
    perHop: Math.round(distance / hops),
    passages,
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
    passage: string | null;
    open: boolean;
  }[];
}

const CONTROL = deriveAreaControl();

export function areaControl(): ReadonlyMap<AreaId, AreaControl> {
  return CONTROL;
}

export function summariseArea(id: AreaId): AreaSummary | null {
  const area = AREAS_BY_ID.get(id);
  if (area === undefined) return null;
  const neighbours = EDGES.filter((edge) => edge.a === id || edge.b === id).map((edge) => {
    const otherId = edge.a === id ? edge.b : edge.a;
    const passage = edge.passage === undefined ? null : (PASSAGES_BY_ID.get(edge.passage) ?? null);
    return {
      id: otherId,
      name: AREAS_BY_ID.get(otherId)?.name ?? otherId,
      passage: passage?.name ?? null,
      open: passage?.open ?? true,
    };
  });
  return {
    id,
    name: area.name,
    control: CONTROL.get(id) ?? {
      owner: null,
      contested: false,
      possessions: 0,
    },
    possessions: POSSESSIONS.filter((p) => p.area === id).map((p) => ({
      id: p.id,
      name: p.name,
      owner: p.owner,
    })),
    fleets: FLEETS.filter((f) => f.area === id).map((f) => ({
      id: f.id,
      name: f.name,
      owner: f.owner,
      ships: f.ships,
    })),
    neighbours,
  };
}

/** One ramp for every nation, so the fills read as a set rather than a rainbow. */
export function nationFill(nation: NationId | null, alpha: number): string {
  if (nation === null) return `oklch(0.55 0 0 / ${alpha * 0.35})`;
  const hue = NATIONS_BY_ID.get(nation)?.hue ?? 0;
  return `oklch(0.66 0.15 ${hue} / ${alpha})`;
}

export function nationStroke(nation: NationId | null): string {
  if (nation === null) return "oklch(0.6 0 0 / 0.5)";
  const hue = NATIONS_BY_ID.get(nation)?.hue ?? 0;
  return `oklch(0.74 0.17 ${hue})`;
}

export function nationName(nation: NationId | null): string {
  if (nation === null) return "Unclaimed";
  return NATIONS_BY_ID.get(nation)?.name ?? nation;
}

export const AREA_COUNT = AREAS.length;
export const EDGE_COUNT = EDGES.length;
