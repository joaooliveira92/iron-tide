import { BluewaveError } from "@bluewave/contracts";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import { WorldMapLayerProvider } from "../layers/WorldMapLayerContext.js";
import type { PlacedLabel } from "../map-label-layout.js";
import type { MapPalette } from "../map-palette.js";
import type { MapPendingOrder } from "../map-orders.js";
import type { Point } from "../projection.js";
import type { WorldMapModel } from "../useWorldMapModel.js";

export interface ProjectedPendingOrder extends MapPendingOrder {
  readonly from: Point;
  readonly to: Point;
}

export interface WorldMapSceneState {
  readonly legalAreas: ReadonlySet<string>;
  readonly dimmedAreas: ReadonlySet<string>;
  readonly blockadedAreas: ReadonlySet<string>;
  readonly pendingOrders: readonly ProjectedPendingOrder[];
  readonly draggableFleets: ReadonlySet<string>;
  readonly selectedFleetId: string | null;
}

export interface WorldMapSceneActions {
  readonly onAreaClick: (id: string, shiftKey: boolean) => void;
}

export interface WorldMapSceneMeta {
  readonly model: WorldMapModel;
  readonly palette: MapPalette;
  readonly width: number;
  readonly labelsByTurn: ReadonlyMap<number, readonly PlacedLabel[]>;
}

export interface WorldMapSceneValue {
  readonly state: WorldMapSceneState;
  readonly actions: WorldMapSceneActions;
  readonly meta: WorldMapSceneMeta;
}

export interface WorldMapRootProps extends WorldMapSceneState {
  readonly model: WorldMapModel;
  readonly palette: MapPalette;
  readonly width: number;
  readonly onAreaClick: (id: string, shiftKey: boolean) => void;
  readonly children: ReactNode;
}

const WorldMapSceneContext = createContext<WorldMapSceneValue | null>(null);

function groupLabelsByTurn(
  labels: readonly PlacedLabel[],
): ReadonlyMap<number, readonly PlacedLabel[]> {
  const grouped = new Map<number, PlacedLabel[]>();
  for (const label of labels) {
    const list = grouped.get(label.turn);
    if (list === undefined) grouped.set(label.turn, [label]);
    else list.push(label);
  }
  return grouped;
}

export function WorldMapRoot({
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
  children,
}: WorldMapRootProps) {
  const labelsByTurn = useMemo(() => groupLabelsByTurn(model.placedLabels), [model.placedLabels]);
  const value = useMemo<WorldMapSceneValue>(
    () => ({
      state: {
        legalAreas,
        dimmedAreas,
        blockadedAreas,
        pendingOrders,
        draggableFleets,
        selectedFleetId,
      },
      actions: { onAreaClick },
      meta: { model, palette, width, labelsByTurn },
    }),
    [
      legalAreas,
      dimmedAreas,
      blockadedAreas,
      pendingOrders,
      draggableFleets,
      selectedFleetId,
      onAreaClick,
      model,
      palette,
      width,
      labelsByTurn,
    ],
  );
  return (
    <WorldMapSceneContext.Provider value={value}>
      <WorldMapLayerProvider palette={palette} strokeFor={model.strokeFor}>
        {children}
      </WorldMapLayerProvider>
    </WorldMapSceneContext.Provider>
  );
}

export function useWorldMapScene(): WorldMapSceneValue {
  const value = useContext(WorldMapSceneContext);
  if (value === null) throw new BluewaveError("WORLD_MAP_SCENE_PROVIDER_MISSING", {});
  return value;
}
