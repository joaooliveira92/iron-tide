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
import { projectionById, type ProjectedArea } from "./projection.js";
import { orderModeMapAreas, pendingRoutes, type MapOrders } from "./map-orders.js";
import { areaAtPoint } from "./map-hit-test.js";
import type { AreaTreeRow } from "./area-tree.js";
import type { MapViewProps } from "./map-contract.js";
import { cn } from "../../lib/utils.js";

const EMPTY_AREAS: ReadonlySet<string> = new Set();

export interface WorldMapChartProps extends MapViewProps {
  readonly className?: string;
  readonly overlay?: LiveWorldMapOverlay;
  readonly variant?: MapVariant;
  readonly showMinimap?: boolean;
  readonly leftPanels?: ReactNode;
  readonly rightPanels?: ReactNode;
  readonly treeDefaultOpen?: boolean;
  readonly initialFocusAreaId?: string | null;
  readonly initialFocusNationId?: string | null;
  readonly orders?: MapOrders;
}

interface PickUp {
  readonly fleetId: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly dragging: boolean;
}

export function WorldMapChart({
  state,
  route,
  onSelect,
  onRuler,
  onToggleLayer,
  onSetProjection,
  onSetCentre,
  overlay = EMPTY_LIVE_OVERLAY,
  className,
  variant = "full",
  showMinimap = true,
  leftPanels,
  rightPanels,
  treeDefaultOpen = true,
  initialFocusAreaId = null,
  initialFocusNationId = null,
  orders,
}: WorldMapChartProps) {
  const layout = MAP_VARIANT_LAYOUT[variant];
  const [toolsOpen, setToolsOpen] = useState(false);
  const [pickUp, setPickUp] = useState<PickUp | null>(null);
  const projection = projectionById(state.projection);
  const camera = useMapCamera(projection.width, projection.height, {
    wrapHorizontally: true,
    coverViewport: variant === "command",
  });
  const palette = useMapPalette();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const coastline = useCoastline();
  const model = useWorldMapModel({ state, route, overlay, projection, palette, camera, rootRef });

  useInitialFocusArea(camera, initialFocusAreaId, projection, state.centre, initialFocusNationId);

  const fleetFor = (fleetId: string | null | undefined) =>
    fleetId === null || fleetId === undefined
      ? null
      : (orders?.fleets.find((fleet) => fleet.fleetId === fleetId) ?? null);

  const activeFleet = fleetFor(pickUp?.fleetId ?? orders?.selectedFleetId);
  const mode = orderModeMapAreas(activeFleet);
  const modeActive = pickUp !== null || (orders !== undefined && orders.selectedFleetId !== null);
  const legalAreas = modeActive ? mode.legal : EMPTY_AREAS;
  const dimmedAreas = new Set<string>();
  if (modeActive && mode.active) {
    const keep = new Set(mode.legal);
    if (activeFleet?.mapAreaId !== null && activeFleet?.mapAreaId !== undefined) {
      keep.add(activeFleet.mapAreaId);
    }
    for (const area of model.areas) {
      if (!keep.has(area.id)) dimmedAreas.add(area.id);
    }
  }
  const blockadedAreas = orders?.blockadedMapAreas ?? EMPTY_AREAS;
  const pending = pendingRoutes(orders?.pending ?? [], (areaId) => model.anchorOf(areaId));
  const draggableFleets = new Set(
    (orders?.fleets ?? [])
      .filter((fleet) => fleet.mapAreaId !== null && fleet.legalDestinations.length > 0)
      .map((fleet) => fleet.fleetId),
  );

  function handleMapKey(event: React.KeyboardEvent<SVGSVGElement>): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (orders !== undefined && (event.key === "f" || event.key === "F")) {
      const fleets = orders.fleets;
      if (fleets.length > 0) {
        const current = fleets.findIndex((fleet) => fleet.fleetId === orders.selectedFleetId);
        const next = fleets[(current + 1) % fleets.length];
        if (next !== undefined) {
          orders.onSelectFleet(next.fleetId);
          const point = next.mapAreaId === null ? null : model.areasById.get(next.mapAreaId)?.label;
          if (point !== null && point !== undefined) camera.focusOn(point[0], point[1], 3.5);
        }
      }
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      setPickUp(null);
      onSelect(null);
      event.preventDefault();
      return;
    }
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

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>): void {
    if (orders === undefined || event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const marker = target.closest("[data-map-fleet]");
    if (!(marker instanceof Element)) return;
    const fleetId = marker.getAttribute("data-map-fleet");
    if (fleetId === null || !draggableFleets.has(fleetId)) return;
    event.stopPropagation();
    camera.holdRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPickUp({
      fleetId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    });
    orders.onSelectFleet(fleetId);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>): void {
    if (pickUp === null || pickUp.pointerId !== event.pointerId) return;
    if (pickUp.dragging) return;
    if (Math.hypot(event.clientX - pickUp.startX, event.clientY - pickUp.startY) < 6) return;
    setPickUp({ ...pickUp, dragging: true });
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>): void {
    if (pickUp === null || pickUp.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const dragging = pickUp.dragging;
    const fleetId = pickUp.fleetId;
    camera.holdRef.current = false;
    setPickUp(null);
    if (!dragging || orders === undefined) return;
    const mapAreaId = areaAt(camera, model.areas, projection, event.clientX, event.clientY);
    if (mapAreaId === null) return;
    orders.onDrop(fleetId, mapAreaId);
  }

  function focusArea(id: string): void {
    onSelect(id);
    const point = model.areasById.get(id)?.label;
    if (point !== undefined) camera.focusOn(point[0], point[1], 3.5);
  }

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
        className="relative h-full w-full cursor-grab touch-none active:cursor-grabbing"
        viewBox={`0 0 ${projection.width} ${projection.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="World map. Arrow keys pan, plus and minus zoom, zero resets."
        tabIndex={0}
        onKeyDown={handleMapKey}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <g ref={camera.worldRef}>
          <MapLayers
            model={model}
            palette={palette}
            width={projection.width}
            onAreaClick={handleAreaClick}
            legalAreas={legalAreas}
            dimmedAreas={dimmedAreas}
            blockadedAreas={blockadedAreas}
            pendingOrders={pending}
            draggableFleets={draggableFleets}
            selectedFleetId={pickUp?.fleetId ?? orders?.selectedFleetId ?? null}
          />
        </g>
      </svg>

      <div className="sr-only">
        <table>
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
      </div>

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
          <MapLegend
            showPossessions={state.layers.possessions}
            showFleets={state.layers.fleets}
            notes={
              orders === undefined
                ? []
                : [
                    "Foreign fleet positions are not known: intelligence is not modelled yet.",
                    "Invasion range is not modelled yet.",
                  ]
            }
          />
          <MapScaleBar camera={camera} worldWidth={projection.width} />
        </div>
      </div>

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

      <RouteReadout
        className={cn(layout.routeReadout, layout.routeHideWhenEmpty && route === null && "hidden")}
        route={route}
      />
    </div>
  );
}

function areaAt(
  camera: ReturnType<typeof useMapCamera>,
  areas: readonly ProjectedArea[],
  projection: { readonly width: number },
  clientX: number,
  clientY: number,
): string | null {
  if (typeof document.elementsFromPoint === "function") {
    for (const element of document.elementsFromPoint(clientX, clientY)) {
      const area = element.closest("[data-map-area]");
      if (area instanceof Element) return area.getAttribute("data-map-area");
    }
  }
  const svg = camera.svgRef.current;
  const matrix = svg?.getScreenCTM?.();
  if (svg === null || svg === undefined || matrix === null || matrix === undefined) return null;
  if (matrix.a === 0 || matrix.d === 0 || typeof svg.createSVGPoint !== "function") return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const user = point.matrixTransform(matrix.inverse());
  const { scale, x, y } = camera.getTransform();
  if (scale === 0) return null;
  return areaAtPoint(areas, { x: (user.x - x) / scale, y: (user.y - y) / scale }, projection.width);
}
