import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import { BluewaveError } from "@bluewave/contracts";
import { createContext, use } from "react";
import type { formatMeasurement } from "../../../../lib/presentation-format/format.js";
import type { niceScaleBar } from "../../../../components/world-map/map-scale.js";
import type { lodBandFor } from "../../../tactical-map/tacticalScale.js";
import type { TacticalViewport } from "../tactical-geometry.js";

export type ScreenPoint = readonly [number, number];

export function createCursorStore() {
  let point: ScreenPoint | null = null;
  const listeners = new Set<() => void>();
  return {
    read: () => point,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    write: (next: ScreenPoint | null) => {
      point = next;
      for (const listener of listeners) listener();
    },
  };
}

export type CursorStore = ReturnType<typeof createCursorStore>;

export type LodBand = ReturnType<typeof lodBandFor>;

export type MapMeasurement = Parameters<typeof formatMeasurement>[1];

export interface TacticalMapGeometry {
  readonly view: PlayerBattleView;
  readonly viewport: TacticalViewport;
  readonly project: (point: readonly [number, number]) => ScreenPoint;
  readonly shipsById: ReadonlyMap<string, PlayerBattleShipView>;
  readonly visibleShips: readonly PlayerBattleShipView[];
  readonly playerSide: string | null;
  readonly symbolSize: number;
  readonly pixelsPerNm: number;
  readonly bar: ReturnType<typeof niceScaleBar>;
  readonly measurement: MapMeasurement;
  readonly moveStyle: string | undefined;
  readonly cursor: CursorStore;
}

export const TacticalMapContext = createContext<TacticalMapGeometry | null>(null);

export function useTacticalMap(): TacticalMapGeometry {
  const value = use(TacticalMapContext);
  if (value === null) throw new BluewaveError("TACTICAL_MAP_PROVIDER_MISSING", {});
  return value;
}
