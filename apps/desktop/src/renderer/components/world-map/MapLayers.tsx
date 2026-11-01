import { memo, useMemo } from "react";

import { WORLD_WRAP_TURNS } from "./projection.js";
import type { MapPalette } from "./map-palette.js";
import type { WorldMapModel } from "./useWorldMapModel.js";
import type { MapPendingOrder } from "./map-orders.js";
import type { Point } from "./projection.js";
import type { PlacedLabel } from "./map-label-layout.js";
import { AreasLayer } from "./layers/AreasLayer.js";
import { FleetsLayer } from "./layers/FleetsLayer.js";
import { GraticuleLayer } from "./layers/GraticuleLayer.js";
import { LabelsLayer } from "./layers/LabelsLayer.js";
import { LanesLayer } from "./layers/LanesLayer.js";
import { OrdersLayer } from "./layers/OrdersLayer.js";
import { PortsLayer } from "./layers/PortsLayer.js";
import { RoutesLayer } from "./layers/RoutesLayer.js";
import { StrengthLayer } from "./layers/StrengthLayer.js";

export interface MapLayersProps {
  readonly model: WorldMapModel;
  readonly palette: MapPalette;
  readonly width: number;
  readonly onAreaClick: (id: string, shiftKey: boolean) => void;
  readonly legalAreas: ReadonlySet<string>;
  readonly dimmedAreas: ReadonlySet<string>;
  readonly blockadedAreas: ReadonlySet<string>;
  readonly pendingOrders: readonly (MapPendingOrder & {
    readonly from: Point;
    readonly to: Point;
  })[];
  readonly draggableFleets: ReadonlySet<string>;
  readonly selectedFleetId: string | null;
}

const NO_LABELS: readonly PlacedLabel[] = [];

export const MapLayers = memo(function MapLayers({
  model,
  palette,
  width,
  onAreaClick,
  legalAreas,
  dimmedAreas,
  blockadedAreas,
  pendingOrders,
  draggableFleets,
  selectedFleetId,
}: MapLayersProps) {
  const { state } = model;
  const labelsByTurn = useMemo(() => {
    const grouped = new Map<number, PlacedLabel[]>();
    for (const label of model.placedLabels) {
      const list = grouped.get(label.turn);
      if (list === undefined) grouped.set(label.turn, [label]);
      else list.push(label);
    }
    return grouped;
  }, [model.placedLabels]);
  return (
    <>
      {WORLD_WRAP_TURNS.map((turn) => (
        <g
          key={turn}
          transform={`translate(${turn * width} 0)`}
          style={turn === 0 ? undefined : { display: "var(--map-copies, inline)" }}
        >
          <GraticuleLayer d={model.graticule} stroke={palette.graticule} />

          <AreasLayer
            turn={turn}
            areas={model.areas}
            control={model.control}
            selected={state.selected}
            routeSet={model.routeSet}
            ownershipOn={state.layers.ownership}
            areaWash={palette.areaWash}
            areaWashSelected={palette.areaWashSelected}
            areaEdge={palette.areaEdge}
            selectedEdge={palette.selectedEdge}
            route={palette.route}
            unavailable={model.unavailable}
            unavailableWash={palette.areaUnavailable}
            nameOf={model.areaName}
            describe={model.describeAreaFor}
            fillFor={model.fillFor}
            onAreaClick={onAreaClick}
            legal={legalAreas}
            dimmed={dimmedAreas}
            blockaded={blockadedAreas}
          />

          {state.layers.lanes && <LanesLayer lanes={model.lanes} stroke={palette.lane} />}

          <RoutesLayer d={model.routePath} stroke={palette.route} casing={palette.routeCasing} />

          {pendingOrders.length > 0 && (
            <OrdersLayer pending={pendingOrders} palette={palette} worldWidth={width} />
          )}

          {state.layers.possessions && (
            <PortsLayer marks={model.portMarks} strokeFor={model.strokeFor} />
          )}

          {state.layers.fleets && (
            <FleetsLayer
              marks={model.fleetMarks}
              strokeFor={model.strokeFor}
              live={model.live}
              playerNationId={model.playerNationId}
              draggable={draggableFleets}
              selectedFleetId={selectedFleetId}
            />
          )}

          {state.layers.fleets && (
            <StrengthLayer
              regions={model.strengths}
              anchorOf={model.anchorOf}
              strokeFor={model.strokeFor}
              palette={palette}
              compact={model.compactGlyphs}
              offsets={model.glyphOffsets}
            />
          )}

          <LabelsLayer
            labels={labelsByTurn.get(turn) ?? NO_LABELS}
            labelInk={palette.labelInk}
            labelHalo={palette.labelHalo}
          />
        </g>
      ))}
    </>
  );
});
