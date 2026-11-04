import { BluewaveError } from "@bluewave/contracts";
import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { MapPalette } from "../map-palette.js";

export interface WorldMapLayerMeta {
  readonly palette: MapPalette;
}

export interface WorldMapLayerActions {
  readonly strokeFor: (nation: string | null) => string;
}

export interface WorldMapLayerContextValue {
  readonly meta: WorldMapLayerMeta;
  readonly actions: WorldMapLayerActions;
}

const WorldMapLayerContext = createContext<WorldMapLayerContextValue | null>(null);

export function WorldMapLayerProvider({
  palette,
  strokeFor,
  children,
}: {
  readonly palette: MapPalette;
  readonly strokeFor: (nation: string | null) => string;
  readonly children: ReactNode;
}) {
  const value = useMemo<WorldMapLayerContextValue>(
    () => ({ meta: { palette }, actions: { strokeFor } }),
    [palette, strokeFor],
  );
  return <WorldMapLayerContext.Provider value={value}>{children}</WorldMapLayerContext.Provider>;
}

export function useWorldMapLayer(): WorldMapLayerContextValue {
  const value = useContext(WorldMapLayerContext);
  if (value === null) throw new BluewaveError("WORLD_MAP_LAYER_PROVIDER_MISSING", {});
  return value;
}
