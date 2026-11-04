import type { CameraProjection, AppCameraState } from "./camera-contract.js";
import type { TileCache } from "./tile-hierarchy.js";
import type { AdapterLandMode } from "./globe-adapter-flag.js";
import type { MapVariant } from "../world-map/map-variant-layout.js";
import type { WorldMapChartProps } from "../world-map/WorldMapChart.js";

export const GLOBE_ASSET_ROOT = "map-assets";

export interface GlobeAdapterProps {
  readonly state: WorldMapChartProps["state"];
  readonly route: WorldMapChartProps["route"];
  readonly overlay: NonNullable<WorldMapChartProps["overlay"]>;
  readonly orders?: WorldMapChartProps["orders"];
  readonly className?: string;
  readonly onSelect: WorldMapChartProps["onSelect"];
  readonly onRuler: WorldMapChartProps["onRuler"];
  readonly onToggleLayer: WorldMapChartProps["onToggleLayer"];
  readonly onSetProjection: WorldMapChartProps["onSetProjection"];
  readonly onSetCentre: WorldMapChartProps["onSetCentre"];
  readonly onUnavailable: (reason: string) => void;
  readonly forceFailure?: boolean;
  readonly landMode?: AdapterLandMode;
  readonly variant?: MapVariant;
  readonly showMinimap?: boolean;
  readonly initialFocusAreaId?: string | null;
  readonly initialFocusNationId?: string | null;
  readonly camera?: AppCameraState | null;
  readonly onCameraChange?: ((camera: AppCameraState) => void) | undefined;
}

export interface AdapterDiagnostics {
  readonly zoom: number;
  readonly centre: readonly [number, number];
  readonly bearing: number;
  readonly pitch: number;
  readonly projection: CameraProjection;
  readonly sourceLevel: number;
  readonly overscaled: boolean;
  readonly visibleTiles: number;
  readonly storeVersion: number;
  readonly markerCount: number;
  readonly routeCount: number;
  readonly cache: ReturnType<TileCache["stats"]>;
  readonly errors: readonly string[];
}

declare global {
  interface Window {
    __globeAdapter?: {
      readonly diagnostics: () => AdapterDiagnostics;
      readonly updateMarker: (id: string, lon: number, lat: number) => boolean;
      readonly setMarkerVisible: (id: string, visible: boolean) => boolean;
      readonly benchmarkMarkers: (count: number) => {
        readonly requested: number;
        readonly applied: number;
        readonly ms: number;
        readonly storeVersion: number;
        readonly markerCount: number;
      };
      readonly benchmarkBatch: (count: number) => {
        readonly requested: number;
        readonly applied: number;
        readonly ms: number;
        readonly storeVersion: number;
      };
      readonly selectArea: (id: string | null) => void;
      readonly featureIds: () => readonly string[];
      readonly featureScreenPoint: (
        id: string,
      ) => { readonly x: number; readonly y: number } | null;
      readonly areaScreenPoint: (id: string) => { readonly x: number; readonly y: number } | null;
      readonly areaLabelsRendered: () => number;
      readonly jumpTo: (lon: number, lat: number, zoom: number) => void;
      readonly setProjection: (projection: CameraProjection) => void;
      readonly whenIdle: () => Promise<void>;
    };
  }
}
