import { useRef, type ReactNode } from "react";
import { cn } from "../../lib/utils.js";
import { CoastlineCanvas } from "./CoastlineCanvas.js";
import { CoastlineStatus } from "./CoastlineStatus.js";
import { MapDocks } from "./MapDocks.js";
import { MapLayers } from "./MapLayers.js";
import { MapReadoutDock } from "./MapReadoutDock.js";
import { OwnershipTable } from "./OwnershipTable.js";
import { MAP_VARIANT_LAYOUT, type MapVariant } from "./map-variant-layout.js";
import { useCoastline } from "./useCoastline.js";
import { useInitialFocusArea } from "./useInitialFocusArea.js";
import { useMapCamera } from "./useMapCamera.js";
import { useMapInteraction } from "./useMapInteraction.js";
import { useMapPalette } from "./map-palette.js";
import { useWorldMapModel } from "./useWorldMapModel.js";
import { EMPTY_LIVE_OVERLAY, type LiveWorldMapOverlay } from "./campaign-map-join.js";
import { projectionById } from "./projection.js";
import type { MapOrders } from "./map-orders.js";
import type { MapViewProps } from "./map-contract.js";
import { WorldMap } from "./scene/WorldMap.js";

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

  const interaction = useMapInteraction({
    state,
    projection,
    camera,
    model,
    overlay,
    orders,
    onSelect,
    onRuler,
  });

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
      <CoastlineStatus coastline={coastline} />
      <svg
        ref={camera.svgRef}
        className="relative h-full w-full cursor-grab touch-none active:cursor-grabbing"
        viewBox={`0 0 ${projection.width} ${projection.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="application"
        aria-label="World map. Arrow keys pan, plus and minus zoom, zero resets."
        tabIndex={0}
        onKeyDown={interaction.handleMapKey}
        onPointerDown={interaction.handlePointerDown}
        onPointerMove={interaction.handlePointerMove}
        onPointerUp={interaction.handlePointerUp}
        onPointerCancel={interaction.handlePointerUp}
      >
        <g ref={camera.worldRef}>
          <WorldMap.Root
            model={model}
            palette={palette}
            width={projection.width}
            onAreaClick={interaction.handleAreaClick}
            legalAreas={interaction.legalAreas}
            dimmedAreas={interaction.dimmedAreas}
            blockadedAreas={interaction.blockadedAreas}
            pendingOrders={interaction.pendingOrders}
            draggableFleets={interaction.draggableFleets}
            selectedFleetId={interaction.activeFleetId}
          >
            <MapLayers />
          </WorldMap.Root>
        </g>
      </svg>

      <OwnershipTable rows={model.ownershipRows} />

      <MapReadoutDock
        camera={camera}
        projection={projection}
        state={state}
        palette={palette}
        minimapPolygons={coastline.status === "ready" && showMinimap ? coastline.polygons : null}
        hasOrders={orders !== undefined}
      />

      <MapDocks
        variant={variant}
        camera={camera}
        model={model}
        state={state}
        route={route}
        onSelect={onSelect}
        onToggleLayer={onToggleLayer}
        onSetProjection={onSetProjection}
        onSetCentre={onSetCentre}
        leftPanels={leftPanels}
        rightPanels={rightPanels}
        treeDefaultOpen={treeDefaultOpen}
        onFocusArea={interaction.focusArea}
      />
    </div>
  );
}
