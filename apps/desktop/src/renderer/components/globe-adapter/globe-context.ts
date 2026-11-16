import { BluewaveError } from "@bluewave/contracts";
import { createContext, use, type KeyboardEvent, type RefCallback, type RefObject } from "react";

import type { MapVariant } from "../world-map/map-variant-layout.js";
import type { LayerId, MapPrototypeState, RouteReading } from "../world-map/map-state.js";
import type { ProjectionId } from "../world-map/projection.js";
import type { AdapterDerivedModel } from "./adapter-derivations.js";
import type { AppCameraState, CameraProjection } from "./camera-contract.js";
import type { EntityRow } from "./entity-rows.js";
import type { TileHierarchy } from "./tile-hierarchy.js";

export interface GlobeSelection {
  readonly area: string | null;
  readonly fleet: string | null;
  readonly hoveredArea: string | null;
}

export interface GlobeState {
  readonly ready: boolean;
  readonly status: string;
  readonly camera: AppCameraState;
  readonly projection: CameraProjection;
  readonly selection: GlobeSelection;
  readonly liveMessage: string;
  readonly hoverText: string | null;
  readonly chart: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly entityRows: readonly EntityRow[];
  readonly derived: AdapterDerivedModel;
}

export interface GlobeActions {
  readonly resetView: () => void;
  readonly setProjection: (projection: ProjectionId) => void;
  readonly toggleProjection: () => void;
  readonly faceNorth: () => void;
  readonly recentre: (lon: number, lat: number) => void;
  readonly select: (area: string | null) => void;
  readonly selectEntity: (entity: EntityRow) => void;
  readonly toggleLayer: (layer: LayerId) => void;
  readonly setCentre: (centre: number) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export interface GlobeMeta {
  readonly variant: MapVariant;
  readonly className: string | undefined;
  readonly hierarchy: TileHierarchy;
  readonly refs: {
    readonly container: RefObject<HTMLDivElement | null>;
    readonly tooltip: RefCallback<HTMLDivElement>;
  };
}

export interface GlobeContextValue {
  readonly state: GlobeState;
  readonly actions: GlobeActions;
  readonly meta: GlobeMeta;
}

export const GlobeContext = createContext<GlobeContextValue | null>(null);

export function useGlobe(): GlobeContextValue {
  const value = use(GlobeContext);
  if (value === null) throw new BluewaveError("GLOBE_PROVIDER_MISSING", { hook: "useGlobe" });
  return value;
}
