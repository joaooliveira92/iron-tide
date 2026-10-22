import type { ProjectionId } from "./projection.js";
import type { LayerId, MapPrototypeState, RouteReading } from "./map-state.js";
import type { AreaId } from "./fixture-world.js";

export interface MapViewProps {
  readonly state: MapPrototypeState;
  readonly route: RouteReading | null;
  readonly onSelect: (area: AreaId | null) => void;
  readonly onRuler: (area: AreaId) => void;
  readonly onToggleLayer: (layer: LayerId) => void;
  readonly onSetProjection: (projection: ProjectionId) => void;
  readonly onSetCentre: (centre: number) => void;
  readonly onToggleClosedPassages: () => void;
}

export interface VariantDefinition {
  readonly key: string;
  readonly name: string;
  readonly premise: string;
  readonly Component: React.ComponentType<MapViewProps>;
}
