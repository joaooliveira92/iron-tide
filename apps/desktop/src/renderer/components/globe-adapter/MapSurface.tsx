import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { WorldMapChart, type WorldMapChartProps } from "../world-map/WorldMapChart.js";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";
import {
  GLOBE_ADAPTER_ENABLED,
  readStoredRenderer,
  resolveOverviewRenderer,
  type OverviewRenderer,
} from "./globe-adapter-flag.js";
import type { AppCameraState } from "./camera-contract.js";
import { recordRendererDiagnostic } from "./renderer-diagnostics.js";
import { detectGraphicsSupport, type GraphicsSupport } from "./webgl-support.js";

const GlobeAdapter = GLOBE_ADAPTER_ENABLED
  ? lazy(() => import("./GlobeAdapter.js").then((module) => ({ default: module.GlobeAdapter })))
  : null;

export type MapSurfaceProps = WorldMapChartProps & {
  readonly enableGlobe?: boolean;
  readonly camera?: AppCameraState | null;
  readonly onCameraChange?: ((camera: AppCameraState) => void) | undefined;
};

function preference(enabled: boolean): OverviewRenderer {
  if (!enabled) return "legacy";
  return resolveOverviewRenderer(
    {
      hash: window.location.hash,
      search: window.location.search,
      stored: readStoredRenderer(),
    },
    GLOBE_ADAPTER_ENABLED,
  );
}

function Fallback({ reason }: { readonly reason: string }) {
  return (
    <div
      role="status"
      className="absolute bottom-2 left-2 z-20 rounded border border-amber-400 bg-amber-950/90 px-3 py-2 text-xs text-amber-100"
    >
      Globe renderer unavailable: {reason}. The standard Overview map is shown.
    </div>
  );
}

export function MapSurface({
  enableGlobe = false,
  camera = null,
  onCameraChange,
  ...props
}: MapSurfaceProps) {
  const [requested, setRequested] = useState<OverviewRenderer>(() => preference(enableGlobe));
  const [failure, setFailure] = useState<string | null>(null);
  const graphics = useMemo<GraphicsSupport>(() => detectGraphicsSupport(), []);

  useEffect(() => {
    const update = () => {
      setRequested(preference(enableGlobe));
      setFailure(null);
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("storage", update);
    };
  }, [enableGlobe]);

  const graphicsFailure = graphics.supported ? null : graphics.reason;
  const fallbackReason = failure ?? graphicsFailure;
  const adapterActive =
    GLOBE_ADAPTER_ENABLED &&
    requested === "globe" &&
    fallbackReason === null &&
    GlobeAdapter !== null;
  const activeRenderer: OverviewRenderer = adapterActive ? "globe" : "legacy";

  useEffect(() => {
    if (fallbackReason === null) {
      recordRendererDiagnostic({ renderer: activeRenderer, event: "started" });
      return;
    }
    recordRendererDiagnostic({ renderer: "legacy", event: "fallback", reason: fallbackReason });
  }, [activeRenderer, fallbackReason]);

  const panels = (
    <>
      {props.leftPanels === undefined ? null : (
        <div className="pointer-events-auto absolute left-2 top-[calc(0.5rem+var(--chrome-top,0px))] z-[9999] max-h-[calc(100%-1rem-var(--chrome-top,0px)-var(--chrome-bottom,0px))] w-[min(22rem,calc(100%-1rem))] overflow-auto">
          {props.leftPanels}
        </div>
      )}
      {props.rightPanels === undefined ? null : (
        <div className="pointer-events-auto absolute right-2 top-[calc(0.5rem+var(--chrome-top,0px))] z-[9999] max-h-[calc(100%-1rem-var(--chrome-top,0px)-var(--chrome-bottom,0px))] w-[min(22rem,calc(100%-1rem))] overflow-auto">
          {props.rightPanels}
        </div>
      )}
    </>
  );

  if (adapterActive) {
    return (
      <div className={`relative ${props.className ?? ""}`}>
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" />}>
          <GlobeAdapter
            state={props.state}
            route={props.route}
            overlay={props.overlay ?? EMPTY_LIVE_OVERLAY}
            orders={props.orders}
            className="absolute inset-0"
            onSelect={props.onSelect}
            onRuler={props.onRuler}
            onToggleLayer={props.onToggleLayer}
            onSetProjection={props.onSetProjection}
            onSetCentre={props.onSetCentre}
            onUnavailable={setFailure}
            variant={props.variant}
            showMinimap={props.showMinimap}
            initialFocusAreaId={props.initialFocusAreaId}
            initialFocusNationId={props.initialFocusNationId}
            camera={camera}
            onCameraChange={onCameraChange}
          />
        </Suspense>
        {panels}
      </div>
    );
  }

  return (
    <div className={`relative ${props.className ?? ""}`}>
      <WorldMapChart {...props} className="h-full w-full" />
      {fallbackReason === null ? null : <Fallback reason={fallbackReason} />}
    </div>
  );
}
