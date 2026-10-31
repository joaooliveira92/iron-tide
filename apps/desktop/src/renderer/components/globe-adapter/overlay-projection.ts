import { AREAS_BY_ID } from "../world-map/map-geometry.js";
import { areaAnchor, type LonLat } from "../world-map/campaign-anchors.js";
import type { LiveWorldMapOverlay } from "../world-map/campaign-map-join.js";
import type { MapOrders, MapPendingOrder } from "../world-map/map-orders.js";
import type { MapPrototypeState, RouteReading } from "../world-map/map-state.js";
import {
  sortOverlayFeatures,
  type MarkerClass,
  type OverlayFeature,
  type OverlaySelection,
  type RouteClass,
} from "./overlay-contract.js";
import { unwrapRoute } from "./route-geometry.js";

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

const FLEET_FAN_DEGREES = 0.9;

function anchor(areaId: string): LonLat | null {
  return AREAS_BY_ID.get(areaId)?.label ?? null;
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function marker(
  id: string,
  order: number,
  at: LonLat,
  label: string,
  markerClass: MarkerClass,
  minZoom: number,
  areaId: string,
  nationId: string,
): OverlayFeature {
  return {
    id,
    kind: "marker",
    order,
    minZoom,
    markerClass,
    label,
    areaId,
    nationId,
    geometry: { type: "Point", lon: at[0], lat: at[1] },
  };
}

function route(
  id: string,
  order: number,
  routeClass: RouteClass,
  coordinates: readonly LonLat[],
  overlayClass: "lane" | "route" = "route",
): OverlayFeature {
  return {
    id,
    kind: "route",
    order,
    minZoom: routeClass === "preview" ? 0.8 : 0,
    routeClass,
    overlayClass,
    geometry: {
      type: "LineString",
      coordinates: unwrapRoute(coordinates),
      semantics: "lonlat-linear",
    },
  };
}

function fanned(at: LonLat, index: number, count: number): LonLat {
  if (count <= 1) return at;
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const lat = at[1] + FLEET_FAN_DEGREES * Math.sin(angle);
  const lon =
    at[0] +
    (FLEET_FAN_DEGREES * Math.cos(angle)) / Math.max(0.2, Math.cos((at[1] * Math.PI) / 180));
  return [lon, lat];
}

function pendingPath(
  overlay: LiveWorldMapOverlay,
  order: MapPendingOrder,
): readonly LonLat[] | null {
  if (order.fromAreaId !== undefined && order.toAreaId !== undefined) {
    const lane = (overlay.seaLanes ?? []).find(
      (candidate) =>
        (candidate.from === order.fromAreaId && candidate.to === order.toAreaId) ||
        (candidate.from === order.toAreaId && candidate.to === order.fromAreaId),
    );
    if (lane !== undefined) {
      return lane.from === order.fromAreaId ? lane.path : [...lane.path].reverse();
    }
    const from = areaAnchor(order.fromAreaId);
    const to = areaAnchor(order.toAreaId);
    if (from !== null && to !== null) return [from, to];
  }
  const from = anchor(order.fromMapAreaId);
  const to = anchor(order.toMapAreaId);
  return from === null || to === null ? null : [from, to];
}

export function projectOverlay(input: OverlayProjectionInput): OverlayProjectionResult {
  const features: OverlayFeature[] = [];
  const ports = [...input.overlay.ports].sort((left, right) => compareIds(left.id, right.id));
  ports.forEach((port, index) => {
    const point = port.anchor ?? anchor(port.area);
    if (point === null) return;
    features.push(
      marker(`port:${port.id}`, 1000 + index, point, port.name, "port", 3, port.area, port.nation),
    );
  });

  const fleets = [...input.overlay.fleets].sort((left, right) => compareIds(left.id, right.id));
  const fleetsPerPoint = new Map<string, number>();
  const placed = fleets.map((fleet) => {
    const point = fleet.anchor ?? anchor(fleet.area);
    if (point === null) return null;
    const key = `${point[0]},${point[1]}`;
    const slot = fleetsPerPoint.get(key) ?? 0;
    fleetsPerPoint.set(key, slot + 1);
    return { fleet, point, key, slot };
  });
  placed.forEach((entry, index) => {
    if (entry === null) return;
    const at = fanned(entry.point, entry.slot, fleetsPerPoint.get(entry.key) ?? 1);
    features.push(
      marker(
        `fleet:${entry.fleet.id}`,
        2000 + index,
        at,
        entry.fleet.name,
        "fleet",
        1,
        entry.fleet.area,
        entry.fleet.nation,
      ),
    );
  });

  const seaLanes = [...(input.overlay.seaLanes ?? [])].sort((left, right) =>
    compareIds(left.id, right.id),
  );
  if (seaLanes.length > 0) {
    seaLanes.forEach((lane, index) => {
      features.push(route(`lane:${lane.id}`, 3000 + index, "static", lane.path, "lane"));
    });
  } else {
    const staticLanes = [...(input.overlay.lanes ?? [])].sort((left, right) =>
      compareIds(`${left.a}~${left.b}`, `${right.a}~${right.b}`),
    );
    staticLanes.forEach((lane, index) => {
      const from = anchor(lane.a);
      const to = anchor(lane.b);
      if (from === null || to === null) return;
      features.push(route(`lane:${lane.a}~${lane.b}`, 3000 + index, "static", [from, to], "lane"));
    });
  }

  const pending = [...(input.orders?.pending ?? [])].sort((left, right) =>
    compareIds(left.commandId, right.commandId),
  );
  pending.forEach((order, index) => {
    const path = pendingPath(input.overlay, order);
    if (path === null) return;
    features.push(route(`pending:${order.commandId}`, 4000 + index, "planned", path));
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
