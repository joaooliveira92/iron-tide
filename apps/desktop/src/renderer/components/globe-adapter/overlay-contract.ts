export const OVERLAY_SCHEMA_VERSION = 1;

export type OverlayFeatureKind = "areaLabel" | "marker" | "route";
export type MarkerClass = "port" | "fleet" | "selection" | "alert";
export type RouteClass = "static" | "planned" | "active" | "preview" | "historical";
export type RouteEdgeSemantics = "lonlat-linear" | "great-circle" | "rhumb";
export type OverlayLayerClass = "lane" | "route";

export interface PointGeometry {
  readonly type: "Point";
  readonly lon: number;
  readonly lat: number;
}

export interface LineGeometry {
  readonly type: "LineString";
  readonly coordinates: readonly (readonly [number, number])[];
  readonly semantics: RouteEdgeSemantics;
}

export interface OverlayFeature {
  readonly id: string;
  readonly kind: OverlayFeatureKind;
  readonly order: number;
  readonly minZoom: number;
  readonly geometry: PointGeometry | LineGeometry;
  readonly label?: string;
  readonly areaId?: string;
  readonly nationId?: string;
  readonly markerClass?: MarkerClass;
  readonly routeClass?: RouteClass;
  readonly overlayClass?: OverlayLayerClass;
}

export interface OverlaySnapshot {
  readonly schemaVersion: typeof OVERLAY_SCHEMA_VERSION;
  readonly version: number;
  readonly features: readonly OverlayFeature[];
}

export interface OverlaySelection {
  readonly selectedId: string | null;
  readonly hoveredId: string | null;
}

export type OverlayChange =
  | { readonly type: "upsert"; readonly id: string; readonly feature: OverlayFeature }
  | { readonly type: "remove"; readonly id: string };

export interface OverlayChangeSet {
  readonly schemaVersion: typeof OVERLAY_SCHEMA_VERSION;
  readonly baseVersion: number;
  readonly version: number;
  readonly changes: readonly OverlayChange[];
}

export interface OverlayVisibilityChange {
  readonly id: string;
  readonly visible: boolean;
}

export interface OverlaySink {
  apply(changeSet: OverlayChangeSet): void;
  visibility(change: OverlayVisibilityChange): void;
  selection(selection: OverlaySelection): void;
}

const KIND_WEIGHT: Readonly<Record<OverlayFeatureKind, number>> = {
  areaLabel: 0,
  route: 1,
  marker: 2,
};

const MARKER_CLASSES: ReadonlySet<MarkerClass> = new Set(["port", "fleet", "selection", "alert"]);
const ROUTE_CLASSES: ReadonlySet<RouteClass> = new Set([
  "static",
  "planned",
  "active",
  "preview",
  "historical",
]);
const ROUTE_SEMANTICS: ReadonlySet<RouteEdgeSemantics> = new Set([
  "lonlat-linear",
  "great-circle",
  "rhumb",
]);
const OVERLAY_LAYER_CLASSES: ReadonlySet<OverlayLayerClass> = new Set(["lane", "route"]);

export class OverlayContractError extends Error {
  readonly _tag = "OverlayContractError";
  readonly reason: "id" | "kind" | "geometry" | "route" | "marker" | "order" | "change" | "store";

  constructor(reason: OverlayContractError["reason"], message: string) {
    super(message);
    this.reason = reason;
  }
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new OverlayContractError("geometry", `${label} must be a finite number`);
  }
  return value;
}

export function assertOverlayFeature(feature: OverlayFeature): void {
  if (typeof feature.id !== "string" || feature.id.length === 0) {
    throw new OverlayContractError("id", "overlay feature id must be a non-empty string");
  }
  if (KIND_WEIGHT[feature.kind] === undefined) {
    throw new OverlayContractError("kind", `unsupported overlay feature kind '${feature.kind}'`);
  }
  if (!Number.isFinite(feature.order) || !Number.isFinite(feature.minZoom)) {
    throw new OverlayContractError("order", `${feature.id} has a non-finite order or minZoom`);
  }
  if (feature.geometry.type === "Point") {
    finite(feature.geometry.lon, `${feature.id}.lon`);
    finite(feature.geometry.lat, `${feature.id}.lat`);
    if (Math.abs(feature.geometry.lat) > 90) {
      throw new OverlayContractError("geometry", `${feature.id}.lat is outside +/-90`);
    }
    if (feature.kind === "route") {
      throw new OverlayContractError("geometry", `${feature.id} is a route with point geometry`);
    }
    if (feature.kind === "marker" && !MARKER_CLASSES.has(feature.markerClass as MarkerClass)) {
      throw new OverlayContractError("marker", `${feature.id} has no valid marker class`);
    }
    return;
  }
  if (feature.geometry.type !== "LineString") {
    throw new OverlayContractError("geometry", `${feature.id} has unsupported geometry`);
  }
  if (feature.kind !== "route") {
    throw new OverlayContractError(
      "geometry",
      `${feature.id} is not a route but has line geometry`,
    );
  }
  if (!ROUTE_CLASSES.has(feature.routeClass as RouteClass)) {
    throw new OverlayContractError("route", `${feature.id} has no valid route class`);
  }
  if (!ROUTE_SEMANTICS.has(feature.geometry.semantics)) {
    throw new OverlayContractError(
      "route",
      `${feature.id} has unsupported edge semantics '${feature.geometry.semantics}'`,
    );
  }
  if (feature.overlayClass !== undefined && !OVERLAY_LAYER_CLASSES.has(feature.overlayClass)) {
    throw new OverlayContractError(
      "route",
      `${feature.id} has unsupported overlay class '${feature.overlayClass}'`,
    );
  }
  if (feature.geometry.coordinates.length < 2) {
    throw new OverlayContractError("geometry", `${feature.id} route needs at least two points`);
  }
  for (const [lon, lat] of feature.geometry.coordinates) {
    finite(lon, `${feature.id}.lon`);
    finite(lat, `${feature.id}.lat`);
  }
}

export function overlayFeatureKey(feature: OverlayFeature): string {
  const keys = Object.keys(feature).sort();
  return keys
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(feature[key as keyof OverlayFeature])}`)
    .join(",");
}

export function compareOverlayFeatures(left: OverlayFeature, right: OverlayFeature): number {
  const kind = KIND_WEIGHT[left.kind] - KIND_WEIGHT[right.kind];
  if (kind !== 0) return kind;
  if (left.order !== right.order) return left.order - right.order;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

export function sortOverlayFeatures(
  features: readonly OverlayFeature[],
): readonly OverlayFeature[] {
  return [...features].sort(compareOverlayFeatures);
}

export function sortOverlayChanges(changes: readonly OverlayChange[]): readonly OverlayChange[] {
  return [...changes].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}
