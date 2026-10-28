import { AREAS_BY_ID } from "../world-map/map-geometry.js";
import type { LiveWorldMapOverlay } from "../world-map/campaign-map-join.js";
import type { MapOrders } from "../world-map/map-orders.js";
import type { MapPrototypeState, RouteReading } from "../world-map/map-state.js";
import {
  sortOverlayFeatures,
  type MarkerClass,
  type OverlayFeature,
  type OverlaySelection,
  type RouteClass,
} from "./overlay-contract.js";

export interface OverlayProjectionInput {
  readonly overlay: LiveWorldMapOverlay;
  readonly state: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly orders?: MapOrders;
  readonly selectedAreaId?: string | null;
}

export interface OverlayProjectionResult {
  readonly features: readonly OverlayFeature[];
  readonly selection: OverlaySelection;
}

function anchor(areaId: string): readonly [number, number] | null {
  return AREAS_BY_ID.get(areaId)?.label ?? null;
}

function marker(
  id: string,
  order: number,
  lon: number,
  lat: number,
  label: string,
  markerClass: MarkerClass,
  minZoom: number,
  areaId: string,
): OverlayFeature {
  return {
    id,
    kind: "marker",
    order,
    minZoom,
    markerClass,
    label,
    areaId,
    geometry: { type: "Point", lon, lat },
  };
}

function route(
  id: string,
  order: number,
  routeClass: RouteClass,
  coordinates: readonly (readonly [number, number])[],
): OverlayFeature {
  return {
    id,
    kind: "route",
    order,
    minZoom: routeClass === "preview" ? 0.8 : 0,
    routeClass,
    geometry: { type: "LineString", coordinates, semantics: "lonlat-linear" },
  };
}

export function projectOverlay(input: OverlayProjectionInput): OverlayProjectionResult {
  const features: OverlayFeature[] = [];
  const ports = [...input.overlay.ports].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  ports.forEach((port, index) => {
    const point = anchor(port.area);
    if (point === null) return;
    features.push(
      marker(`port:${port.id}`, 1000 + index, point[0], point[1], port.name, "port", 3, port.area),
    );
  });
  const fleets = [...input.overlay.fleets].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  fleets.forEach((fleet, index) => {
    const point = anchor(fleet.area);
    if (point === null) return;
    features.push(
      marker(
        `fleet:${fleet.id}`,
        2000 + index,
        point[0],
        point[1],
        fleet.name,
        "fleet",
        1,
        fleet.area,
      ),
    );
  });

  const staticLanes = [...(input.overlay.lanes ?? [])].sort((left, right) => {
    const leftKey = `${left.a}~${left.b}`;
    const rightKey = `${right.a}~${right.b}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  staticLanes.forEach((lane, index) => {
    const from = anchor(lane.a);
    const to = anchor(lane.b);
    if (from === null || to === null) return;
    features.push(route(`lane:${lane.a}~${lane.b}`, 3000 + index, "static", [from, to]));
  });

  const pending = [...(input.orders?.pending ?? [])].sort((left, right) =>
    left.commandId < right.commandId ? -1 : left.commandId > right.commandId ? 1 : 0,
  );
  pending.forEach((order, index) => {
    const from = anchor(order.fromMapAreaId);
    const to = anchor(order.toMapAreaId);
    if (from === null || to === null) return;
    features.push(route(`pending:${order.commandId}`, 4000 + index, "planned", [from, to]));
  });

  if (input.route !== null) {
    const points = input.route.path.flatMap((areaId) => {
      const point = anchor(areaId);
      return point === null ? [] : [point];
    });
    if (points.length >= 2) {
      features.push(route(`preview:${input.route.path.join(">")}`, 5000, "preview", points));
    }
  }

  return {
    features: sortOverlayFeatures(features),
    selection: {
      selectedId: input.selectedAreaId ?? input.state.selected,
      hoveredId: null,
    },
  };
}
