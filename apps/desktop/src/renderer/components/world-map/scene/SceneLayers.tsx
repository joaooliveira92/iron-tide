import { AreasLayer } from "../layers/AreasLayer.js";
import { FleetsLayer } from "../layers/FleetsLayer.js";
import { GraticuleLayer } from "../layers/GraticuleLayer.js";
import { LabelsLayer } from "../layers/LabelsLayer.js";
import { LanesLayer } from "../layers/LanesLayer.js";
import { OrdersLayer } from "../layers/OrdersLayer.js";
import { PortsLayer } from "../layers/PortsLayer.js";
import { RoutesLayer } from "../layers/RoutesLayer.js";
import { StrengthLayer } from "../layers/StrengthLayer.js";
import type { PlacedLabel } from "../map-label-layout.js";
import { useWorldTurn } from "./WorldCopies.js";
import { useWorldMapScene } from "./WorldMapScene.js";

const NO_LABELS: readonly PlacedLabel[] = [];

export function SceneGraticule() {
  const { model, palette } = useWorldMapScene().meta;
  return <GraticuleLayer d={model.graticule} stroke={palette.graticule} />;
}

export function SceneAreas() {
  const turn = useWorldTurn();
  const { state, actions, meta } = useWorldMapScene();
  const { model, palette } = meta;
  return (
    <AreasLayer
      turn={turn}
      areas={model.areas}
      control={model.control}
      selected={model.state.selected}
      routeSet={model.routeSet}
      ownershipOn={model.state.layers.ownership}
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
      onAreaClick={actions.onAreaClick}
      legal={state.legalAreas}
      dimmed={state.dimmedAreas}
      blockaded={state.blockadedAreas}
    />
  );
}

export function SceneLanes() {
  const { model, palette } = useWorldMapScene().meta;
  if (!model.state.layers.lanes) return null;
  return <LanesLayer lanes={model.lanes} stroke={palette.lane} />;
}

export function SceneRoutes() {
  const { model, palette } = useWorldMapScene().meta;
  return <RoutesLayer d={model.routePath} stroke={palette.route} casing={palette.routeCasing} />;
}

export function SceneOrders() {
  const { state, meta } = useWorldMapScene();
  if (state.pendingOrders.length === 0) return null;
  return <OrdersLayer pending={state.pendingOrders} worldWidth={meta.width} />;
}

export function ScenePorts() {
  const { model } = useWorldMapScene().meta;
  if (!model.state.layers.possessions) return null;
  return <PortsLayer marks={model.portMarks} />;
}

export function SceneFleets() {
  const { state, meta } = useWorldMapScene();
  const { model } = meta;
  if (!model.state.layers.fleets) return null;
  return (
    <FleetsLayer
      marks={model.fleetMarks}
      live={model.live}
      playerNationId={model.playerNationId}
      draggable={state.draggableFleets}
      selectedFleetId={state.selectedFleetId}
    />
  );
}

export function SceneStrength() {
  const { model } = useWorldMapScene().meta;
  if (!model.state.layers.fleets) return null;
  return (
    <StrengthLayer
      regions={model.strengths}
      anchorOf={model.anchorOf}
      variant={model.glyphVariant}
      offsets={model.glyphOffsets}
    />
  );
}

export function SceneLabels() {
  const turn = useWorldTurn();
  const { labelsByTurn, palette } = useWorldMapScene().meta;
  return (
    <LabelsLayer
      labels={labelsByTurn.get(turn) ?? NO_LABELS}
      labelInk={palette.labelInk}
      labelHalo={palette.labelHalo}
    />
  );
}
