import { WORLD_WRAP_TURNS } from "./projection.js";
import type { MapPalette } from "./map-palette.js";
import type { WorldMapModel } from "./useWorldMapModel.js";
import { AreasLayer } from "./layers/AreasLayer.js";
import { FleetsLayer } from "./layers/FleetsLayer.js";
import { GraticuleLayer } from "./layers/GraticuleLayer.js";
import { LabelsLayer } from "./layers/LabelsLayer.js";
import { LanesLayer } from "./layers/LanesLayer.js";
import { PassagesLayer } from "./layers/PassagesLayer.js";
import { PortsLayer } from "./layers/PortsLayer.js";
import { RoutesLayer } from "./layers/RoutesLayer.js";
import { StrengthLayer } from "./layers/StrengthLayer.js";

export interface MapLayersProps {
  readonly model: WorldMapModel;
  readonly palette: MapPalette;
  /** World height; the map draws one copy per turn at ±width. */
  readonly width: number;
  readonly onAreaClick: (id: string, shiftKey: boolean) => void;
}

/**
 * Every data layer, once per world copy. The whole antimeridian strategy is
 * these three translated copies — no clipping, no ring splitting — so markers
 * and labels wrap with the polygons they belong to.
 */
export function MapLayers({ model, palette, width, onAreaClick }: MapLayersProps) {
  const { state } = model;
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
          />

          {state.layers.lanes && <LanesLayer lanes={model.lanes} stroke={palette.lane} />}

          <RoutesLayer d={model.routePath} stroke={palette.route} casing={palette.routeCasing} />

          {state.layers.passages && <PassagesLayer marks={model.passageMarks} palette={palette} />}

          {state.layers.possessions && (
            <PortsLayer marks={model.portMarks} strokeFor={model.strokeFor} />
          )}

          {state.layers.fleets && (
            <FleetsLayer
              marks={model.fleetMarks}
              strokeFor={model.strokeFor}
              live={model.live}
              playerNationId={model.playerNationId}
            />
          )}

          {state.layers.fleets && (
            <StrengthLayer
              regions={model.strengths}
              anchorOf={model.anchorOf}
              strokeFor={model.strokeFor}
              palette={palette}
            />
          )}

          <LabelsLayer
            labels={model.placedLabels.filter((label) => label.turn === turn)}
            labelInk={palette.labelInk}
            labelHalo={palette.labelHalo}
          />
        </g>
      ))}
    </>
  );
}
