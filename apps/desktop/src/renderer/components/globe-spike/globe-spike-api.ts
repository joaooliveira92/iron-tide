import type { BakedTiles } from "./baked-tiles.js";
import type { HorizonClass } from "./horizon.js";
import type { LandPlan } from "./use-land-plan.js";

export type SpikeIntent =
  | { readonly type: "zoomAround"; readonly levels: number; readonly x: number; readonly y: number }
  | { readonly type: "panBy"; readonly dx: number; readonly dy: number }
  | {
      readonly type: "setView";
      readonly lon: number;
      readonly lat: number;
      readonly zoom: number;
      readonly bearing?: number;
      readonly pitch?: number;
    };

export interface ReplayResult {
  readonly zoom: number;
  readonly centre: readonly [number, number];
  readonly bearing: number;
  readonly pitch: number;
  readonly maxAnchorDriftPx: number;
}

export interface ProbeResult {
  readonly requested: number;
  readonly missing: number;
  readonly maxErrorPx: number | null;
  readonly meanErrorPx: number | null;
}

export interface GlobeSpikeApi {
  readonly jumpTo: (lon: number, lat: number, zoom: number) => void;
  readonly setView: (view: {
    lon: number;
    lat: number;
    zoom: number;
    bearing?: number;
    pitch?: number;
  }) => void;
  readonly status: () => {
    readonly zoom: number;
    readonly centre: readonly [number, number];
    readonly globeness: number | null;
    readonly idle: boolean;
    readonly land: LandStatus;
  };
  readonly samplePixels: (
    points: readonly (readonly [number, number])[],
  ) => readonly (readonly [number, number, number])[];
  readonly bakedDiagnostics: () => BakedTiles["diagnostics"] | null;
  readonly markerRenderedPixels: (id: string) => Promise<number>;
  readonly project: (id: string) => readonly [number, number] | null;
  readonly projectLonLat: (lon: number, lat: number) => readonly [number, number];
  readonly unproject: (x: number, y: number) => readonly [number, number];
  readonly hitMarker: (id: string) => boolean;
  readonly visibleMarkerIds: () => readonly string[];
  readonly horizonPrediction: () => readonly {
    readonly id: string;
    readonly beyondHorizon: boolean;
    readonly horizonClass: HorizonClass;
    readonly marginDegrees: number;
    readonly visible: boolean;
    readonly renderedAnywhere: boolean;
  }[];
  readonly pickAreas: (x: number, y: number) => readonly string[];
  readonly truthAreas: (lon: number, lat: number) => readonly string[];
  readonly areaIds: () => readonly string[];
  readonly areaLabel: (id: string) => readonly [number, number] | null;
  readonly runProbes: (points: readonly (readonly [number, number])[]) => Promise<ProbeResult>;
  readonly applyIntent: (intent: SpikeIntent) => number;
  readonly replay: (trace: readonly SpikeIntent[]) => ReplayResult;
  readonly select: (id: string) => void;
  readonly selected: () => string | null;
  readonly selectedIndicator: () => {
    readonly visible: boolean;
    readonly x: number;
    readonly y: number;
  } | null;
  readonly canvasPaintedPixels: () => number;
  readonly errors: () => readonly string[];
  readonly labelsRendered: () => number;
  readonly whenIdle: () => Promise<void>;
  readonly liveMessage: () => string;
}

declare global {
  interface Window {
    __globeSpike?: GlobeSpikeApi;
  }
}

export interface LandStatus {
  readonly source: "baked" | "runtime";
  readonly tileMaxZoom: number | null;
  readonly fitForPurposeMaxZoom: number | null;
  readonly overscaled: boolean;
  readonly fallbackReason: string | null;
}

export function landStatus(plan: LandPlan, zoom: number): LandStatus {
  if (plan.kind === "baked") {
    const { zoom: range } = plan.tiles.manifest;
    return {
      source: "baked",
      tileMaxZoom: range.tileMax,
      fitForPurposeMaxZoom: range.fitForPurposeMax,
      overscaled: zoom > range.fitForPurposeMax,
      fallbackReason: null,
    };
  }
  return {
    source: "runtime",
    tileMaxZoom: null,
    fitForPurposeMaxZoom: null,
    overscaled: false,
    fallbackReason: plan.kind === "runtime" ? plan.reason : null,
  };
}
