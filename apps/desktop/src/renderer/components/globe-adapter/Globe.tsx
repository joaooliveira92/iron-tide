import type { ReactNode } from "react";

import { MAP_CONTAINER_STYLE } from "../globe-spike/map-container.js";
import { MAP_VARIANT_LAYOUT } from "../world-map/map-variant-layout.js";
import { GlobeAdapterChrome } from "./GlobeAdapterChrome.js";
import { GlobeAdapterLayers } from "./GlobeAdapterLayers.js";
import { GlobeAdapterLegend } from "./GlobeAdapterLegend.js";
import { GlobeAdapterScreenReader } from "./GlobeAdapterScreenReader.js";
import { GlobeAdapterStatusStrip } from "./GlobeAdapterStatusStrip.js";
import { GlobeMinimap } from "./GlobeAdapterWidgets.js";
import { useGlobe } from "./globe-context.js";
import { GlobeProvider } from "./GlobeProvider.js";

const MAP_ARIA_LABEL =
  "Strategic world map, experimental globe adapter. Use arrow keys to pan, shift plus arrow keys for a longer pan, plus and minus to zoom, zero to reset the view, f to cycle fleets, n for north and Escape to clear the selection. A list of areas, ports and fleets is keyboard accessible.";

function Frame({ children }: { readonly children: ReactNode }) {
  const { state, meta } = useGlobe();
  return (
    <div
      data-testid="globe-adapter"
      data-globe-adapter-projection={state.projection}
      data-globe-adapter-ready={state.ready ? "true" : "false"}
      data-map-variant={meta.variant}
      className={`absolute inset-0 z-[9998] bg-[#cdf3fa] ${MAP_VARIANT_LAYOUT[meta.variant].root} ${meta.className ?? ""}`}
    >
      {children}
    </div>
  );
}

function Canvas() {
  const { state, actions, meta } = useGlobe();
  return (
    <>
      <div
        ref={meta.refs.container}
        role="application"
        aria-label={MAP_ARIA_LABEL}
        tabIndex={0}
        onKeyDown={actions.onKeyDown}
        className="absolute inset-0"
        style={MAP_CONTAINER_STYLE}
      />
      <GlobeAdapterStatusStrip
        label={state.status}
        projection={state.projection}
        onToggleProjection={actions.toggleProjection}
        onNorth={actions.faceNorth}
      />
      {state.hoverText === null ? null : (
        <div
          ref={meta.refs.tooltip}
          role="tooltip"
          data-testid="globe-adapter-tooltip"
          className="pointer-events-none absolute z-30 max-w-64 rounded bg-black/85 px-2 py-1 text-xs text-white"
        >
          {state.hoverText}
        </div>
      )}
    </>
  );
}

function Layers() {
  const { state, actions, meta } = useGlobe();
  return (
    <GlobeAdapterLayers
      state={state.chart}
      variant={meta.variant}
      treeRows={state.derived.treeRows}
      ownershipRows={state.derived.ownershipRows}
      onSelect={actions.select}
      onToggleLayer={actions.toggleLayer}
      onSetProjection={actions.setProjection}
      onSetCentre={actions.setCentre}
      onReset={actions.resetView}
      entityRows={state.entityRows}
      onSelectEntity={actions.selectEntity}
    />
  );
}

function Chrome() {
  const { state, actions, meta } = useGlobe();
  return (
    <GlobeAdapterChrome
      variant={meta.variant}
      ownershipRows={state.derived.ownershipRows}
      summary={state.derived.summary}
      nameFor={state.derived.nameFor}
      onSelect={actions.select}
      entityRows={state.entityRows}
      onSelectEntity={actions.selectEntity}
    />
  );
}

function Legend({ children }: { readonly children?: ReactNode }) {
  const { state, meta } = useGlobe();
  return (
    <GlobeAdapterLegend
      state={state.chart}
      route={state.route}
      viewport={state.camera}
      variant={meta.variant}
    >
      {children}
    </GlobeAdapterLegend>
  );
}

function Minimap() {
  const { state, actions } = useGlobe();
  return <GlobeMinimap viewport={state.camera} onRecentre={actions.recentre} />;
}

function ScreenReader() {
  const { state, meta } = useGlobe();
  return (
    <GlobeAdapterScreenReader
      liveMessage={state.liveMessage}
      entityRows={state.entityRows}
      camera={state.camera}
      hierarchy={meta.hierarchy}
    />
  );
}

export const Globe = {
  Provider: GlobeProvider,
  Frame,
  Canvas,
  Layers,
  Chrome,
  Legend,
  Minimap,
  ScreenReader,
};
