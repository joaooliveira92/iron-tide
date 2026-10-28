import { lazy, Suspense, useEffect, useState } from "react";

import { WorldMapChart, type WorldMapChartProps } from "../world-map/WorldMapChart.js";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";
import { GLOBE_ADAPTER_ENABLED, adapterRequested } from "./globe-adapter-flag.js";

const GlobeAdapter = GLOBE_ADAPTER_ENABLED
  ? lazy(() => import("./GlobeAdapter.js").then((module) => ({ default: module.GlobeAdapter })))
  : null;

function Fallback({ reason }: { readonly reason: string }) {
  return (
    <div
      role="alert"
      className="absolute bottom-2 left-2 z-20 rounded border border-amber-400 bg-amber-950/90 px-3 py-2 text-xs text-amber-100"
    >
      Globe adapter unavailable: {reason}. The current Overview renderer is shown.
    </div>
  );
}

export function MapSurface(props: WorldMapChartProps) {
  const [requested, setRequested] = useState(() => adapterRequested(window.location.hash));
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setRequested(adapterRequested(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const adapterActive =
    GLOBE_ADAPTER_ENABLED && requested && failure === null && GlobeAdapter !== null;
  const panels = (
    <>
      {props.leftPanels === undefined ? null : (
        <div className="pointer-events-auto absolute left-2 top-2 z-10 max-h-[calc(100%-1rem)] w-[min(22rem,calc(100%-1rem))] overflow-auto">
          {props.leftPanels}
        </div>
      )}
      {props.rightPanels === undefined ? null : (
        <div className="pointer-events-auto absolute right-2 top-2 z-10 max-h-[calc(100%-1rem)] w-[min(22rem,calc(100%-1rem))] overflow-auto">
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
          />
        </Suspense>
        {panels}
      </div>
    );
  }

  return (
    <div className={`relative ${props.className ?? ""}`}>
      <WorldMapChart {...props} className="h-full w-full" />
      {failure === null ? null : <Fallback reason={failure} />}
    </div>
  );
}
