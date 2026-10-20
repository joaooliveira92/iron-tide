/**
 * The Admiralty-chart world map — real coastlines, areas as translucent
 * ownership washes over them. The ocean is transparent, so the map surface
 * follows the app theme (see map-palette.ts).
 *
 * This component is a composition root only: it wires the camera, the view
 * model (`useWorldMapModel`), the coastline and the three shells together and
 * renders. All geometry lives in pure modules (projection, map-markers,
 * map-label-layout); all derivation lives in the view model; every SVG layer
 * and every piece of floating chrome is its own component. The one per-shell
 * difference table is `map-variant-layout.ts`.
 */

import { useRef, useState, type ReactNode } from "react";
import { Button } from "../ui/button.js";
import { CollapsiblePanel } from "../shared/CollapsiblePanel.js";
import { AreaTreePanel } from "./AreaTreePanel.js";
import { AreaInspector } from "./AreaInspector.js";
import { CHART } from "./chart-theme.js";
import { CoastlineCanvas } from "./CoastlineCanvas.js";
import { MapControlsPanel } from "./MapControlsPanel.js";
import { MapLayers } from "./MapLayers.js";
import { MapLegend } from "./MapLegend.js";
import { MapMinimap } from "./MapMinimap.js";
import { MapScaleBar } from "./MapScaleBar.js";
import { RouteReadout } from "./RouteReadout.js";
import { MAP_VARIANT_LAYOUT, type MapVariant } from "./map-variant-layout.js";
import { useCoastline } from "./useCoastline.js";
import { useInitialFocusArea } from "./useInitialFocusArea.js";
import { useMapCamera } from "./useMapCamera.js";
import { useMapPalette } from "./map-palette.js";
import { useWorldMapModel } from "./useWorldMapModel.js";
import { EMPTY_LIVE_OVERLAY, type LiveWorldMapOverlay } from "./campaign-map-join.js";
import { projectionById } from "./projection.js";
import type { AreaTreeRow } from "./area-tree.js";
import type { MapViewProps } from "./map-contract.js";
import { cn } from "../../lib/utils.js";

export interface WorldMapChartProps extends MapViewProps {
  readonly className?: string;
  /** Optional live campaign overlay; defaults to the static prototype fixture. */
  readonly overlay?: LiveWorldMapOverlay;
  /**
   * "full" shows every control (the F1 map). "panel" is the embedded variant for
   * the Overview: layer controls collapse behind a Layers button and the idle
   * hint cards stay out of the way, so the chart gets the space. "command" is the full-bleed
   * campaign home (CC-2): no frame, and the controls, area tree, inspector and the host's panels
   * float over the chart in left and right docks that let pointer events through to the map.
   */
  readonly variant?: MapVariant;
  readonly showMinimap?: boolean;
  /** "command" only: panels stacked under the area tree in the left dock. */
  readonly leftPanels?: ReactNode;
  /** "command" only: panels stacked above the inspector in the right dock. */
  readonly rightPanels?: ReactNode;
  /** "command" only: whether the area tree starts open (compact density passes false). */
  readonly treeDefaultOpen?: boolean;
  /**
   * A campaign area id whose home waters the camera should centre on when the chart mounts (the
   * Overview passes the player nation's home area). Null/undefined leaves the camera at "fit world".
   */
  readonly initialFocusAreaId?: string | null;
  /** The player's nation: the opening view then frames its land as well as its home waters. */
  readonly initialFocusNationId?: string | null;
}

export function WorldMapChart({
  state,
  route,
  onSelect,
  onRuler,
  onToggleLayer,
  onSetProjection,
  onSetCentre,
  onToggleClosedPassages,
  overlay = EMPTY_LIVE_OVERLAY,
  className,
  variant = "full",
  showMinimap = true,
  leftPanels,
  rightPanels,
  treeDefaultOpen = true,
  initialFocusAreaId = null,
  initialFocusNationId = null,
}: WorldMapChartProps) {
  const layout = MAP_VARIANT_LAYOUT[variant];
  const [toolsOpen, setToolsOpen] = useState(false);
  const projection = projectionById(state.projection);
  const camera = useMapCamera(projection.width, projection.height, {
    wrapHorizontally: true,
    coverViewport: variant === "command",
  });
  const palette = useMapPalette();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const coastline = useCoastline();
  const model = useWorldMapModel({ state, route, overlay, projection, palette, camera, rootRef });

  // Open centred on the player's home waters (once per mount). This runs after the camera's own
  // reset effect, declared earlier in `useMapCamera`, so the focus is not immediately undone; the
  // Overview remounts the chart each time the screen opens, so it fires on every visit.
  useInitialFocusArea(camera, initialFocusAreaId, projection, state.centre, initialFocusNationId);

  /** Keyboard parity for pan/zoom (wheel and drag stay the pointer path). */
  function handleMapKey(event: React.KeyboardEvent<SVGSVGElement>): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const step = event.shiftKey ? 240 : 80;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (move !== undefined) camera.panBy(move[0], move[1]);
    else if (event.key === "+" || event.key === "=") camera.zoomBy(1.4);
    else if (event.key === "-" || event.key === "_") camera.zoomBy(1 / 1.4);
    else if (event.key === "0") camera.reset();
    else return;
    event.preventDefault();
  }

  function handleAreaClick(id: string, shiftKey: boolean): void {
    if (camera.isDraggingRef.current) return;
    if (shiftKey) onRuler(id);
    else onSelect(id);
  }

  /** Select an area and bring it into view (the area list's job). */
  function focusArea(id: string): void {
    onSelect(id);
    const point = model.areasById.get(id)?.label;
    if (point !== undefined) camera.focusOn(point[0], point[1], 3.5);
  }

  /** A tree row was chosen: select its map area (which opens the inspector) and zoom to it. */
  function focusTreeRow(row: AreaTreeRow): void {
    if (row.mapAreaId !== null) focusArea(row.mapAreaId);
  }

  return (
    <div
      ref={rootRef}
      style={{
        ["--map-focus" as string]: palette.selectedEdge,
        ["--map-hover" as string]: palette.hoverEdge,
        background: palette.ocean,
      }}
      className={cn("relative h-full w-full overflow-hidden", layout.root, className)}
    >
      {coastline.status === "ready" && (
        <CoastlineCanvas
          camera={camera}
          polygons={coastline.polygons}
          projection={projection}
          centre={state.centre}
          fill={palette.land}
          stroke={palette.landEdge}
          borders={model.borderSets}
        />
      )}
      {coastline.status !== "ready" && (
        <div
          role="status"
          className="absolute left-1/2 top-[calc(var(--chrome-top,0px)+0.75rem)] z-10 -translate-x-1/2 rounded-md border px-2.5 py-1 text-xs"
          style={{
            background: "oklch(0.16 0.025 245 / 0.85)",
            borderColor: "oklch(0.4 0.02 245)",
            color: CHART.ink,
          }}
        >
          {coastline.status === "loading"
            ? "Loading coastline…"
            : `Coastline unavailable: ${coastline.message}`}
        </div>
      )}
      <svg
        ref={camera.svgRef}
        // `relative` lifts the SVG above the (positioned) coastline canvas, so labels
        // and markers draw over land instead of vanishing under it.
        className="relative h-full w-full cursor-grab touch-none active:cursor-grabbing"
        viewBox={`0 0 ${projection.width} ${projection.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="World map. Arrow keys pan, plus and minus zoom, zero resets."
        tabIndex={0}
        onKeyDown={handleMapKey}
      >
        <g ref={camera.worldRef}>
          <MapLayers
            model={model}
            palette={palette}
            width={projection.width}
            onAreaClick={handleAreaClick}
          />
        </g>
      </svg>

      <table className="sr-only">
        <caption>Area control</caption>
        <thead>
          <tr>
            <th scope="col">Area</th>
            <th scope="col">Controlled by</th>
            <th scope="col">Fleets</th>
            <th scope="col">Strength</th>
          </tr>
        </thead>
        <tbody>
          {model.ownershipRows.map((row) => (
            <tr key={row.id} aria-selected={row.selected}>
              <th scope="row">{row.name}</th>
              <td>{row.owner ?? "Unclaimed"}</td>
              <td>{row.fleets}</td>
              <td>{row.strength ?? "No ships"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        data-map-obstacle
        className="absolute bottom-[calc(var(--chrome-bottom,0px)+0.75rem)] right-3 flex flex-col items-end gap-2"
      >
        {coastline.status === "ready" && showMinimap && (
          <MapMinimap
            camera={camera}
            projection={projection}
            centre={state.centre}
            polygons={coastline.polygons}
            land={palette.minimapLand}
            ocean={palette.minimapOcean}
            ink={palette.minimapInk}
            borderColor={palette.minimapBorder}
          />
        )}
        <div
          className="pointer-events-none rounded-md border px-2.5 py-1.5 backdrop-blur"
          style={{
            background: "oklch(0.16 0.025 245 / 0.85)",
            borderColor: "oklch(0.4 0.02 245)",
            color: CHART.ink,
          }}
        >
          <MapLegend showPossessions={state.layers.possessions} showFleets={state.layers.fleets} />
          <MapScaleBar camera={camera} worldWidth={projection.width} />
        </div>
      </div>

      {/* Chrome: a floating toolbar, chart-styled rather than app-styled — a
          deliberate choice, so the chart reads as a chart rather than another
          panel of the shell. */}
      <div className={layout.leftDock} data-testid={layout.docked ? "map-left-dock" : undefined}>
        {layout.layersButton !== null && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={layout.layersButton}
            aria-expanded={toolsOpen}
            title="Layers, projection and centre. Click an area to inspect it; shift-click two areas for a route reading."
            onClick={() => setToolsOpen((open) => !open)}
          >
            Layers &amp; areas
          </Button>
        )}
        <MapControlsPanel
          className={cn(
            layout.controlsPanel,
            layout.controlsHideWhenClosed && !toolsOpen && "hidden",
          )}
          state={state}
          onSetProjection={onSetProjection}
          onToggleLayer={onToggleLayer}
          onSetCentre={onSetCentre}
          onReset={camera.reset}
          meterRef={camera.meterRef}
          inlineAreas={layout.inlineAreas}
          treeRows={model.treeRows}
          onFocusTreeRow={focusTreeRow}
        />
        {layout.docked && (
          <CollapsiblePanel
            panelId="map-areas"
            title="Areas"
            badge={`(${model.treeRows.length})`}
            defaultOpen={treeDefaultOpen}
            testId="area-list"
          >
            <AreaTreePanel rows={model.treeRows} onSelectArea={focusTreeRow} />
          </CollapsiblePanel>
        )}
        {layout.docked && leftPanels}
      </div>

      <div className={layout.rightDock} data-testid={layout.docked ? "map-right-dock" : undefined}>
        {layout.docked && rightPanels}

        {/* Chrome: inspector floats over the chart rather than taking layout. */}
        <AreaInspector
          className={cn(
            layout.inspector,
            layout.inspectorHideWhenEmpty && model.summary === null && "hidden",
          )}
          summary={model.summary}
          nameFor={model.nameFor}
          onSelect={onSelect}
        />
      </div>

      {/* Chrome: the ruler readout. */}
      <RouteReadout
        className={cn(layout.routeReadout, layout.routeHideWhenEmpty && route === null && "hidden")}
        route={route}
        respectClosedPassages={state.respectClosedPassages}
        onToggleClosedPassages={onToggleClosedPassages}
      />
    </div>
  );
}
