import { useCallback, type KeyboardEvent, type MutableRefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

import { AREAS_BY_ID } from "../world-map/map-geometry.js";
import type { WorldMapChartProps } from "../world-map/WorldMapChart.js";

interface MapKeyboardInput {
  readonly mapRef: MutableRefObject<MapLibreMap | null>;
  readonly orders: WorldMapChartProps["orders"];
  readonly onSelect: WorldMapChartProps["onSelect"];
  readonly onResetView: () => void;
  readonly setSelectedFleet: (fleetId: string | null) => void;
  readonly setLiveMessage: (message: string) => void;
}

export function useMapKeyboard({
  mapRef,
  orders,
  onSelect,
  onResetView,
  setSelectedFleet,
  setLiveMessage,
}: MapKeyboardInput) {
  return useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const map = mapRef.current;
      const fleets = orders?.fleets ?? [];
      const cycleFleet = () => {
        if (fleets.length === 0) return;
        const current = fleets.findIndex((fleet) => fleet.fleetId === orders?.selectedFleetId);
        const next = fleets[(current + 1) % fleets.length];
        if (next === undefined) return;
        orders?.onSelectFleet(next.fleetId);
        setSelectedFleet(next.fleetId);
        const anchor = next.mapAreaId === null ? null : AREAS_BY_ID.get(next.mapAreaId)?.label;
        if (map !== null && anchor !== undefined && anchor !== null) {
          map.jumpTo({ center: [anchor[0], anchor[1]], zoom: Math.max(3.5, map.getZoom()) });
        }
        setLiveMessage(`Focused fleet ${next.fleetName}`);
      };
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === "f" || event.key === "F") {
          event.preventDefault();
          cycleFleet();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setSelectedFleet(null);
          onSelect(null);
          return;
        }
      }
      if (map === null) return;
      const step = event.shiftKey ? 240 : 120;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const move = (dx: number, dy: number) =>
        map.panBy([dx, dy], { animate: !reduced, duration: reduced ? 0 : 250 });
      const handlers: Record<string, () => void> = {
        ArrowLeft: () => move(step, 0),
        ArrowRight: () => move(-step, 0),
        ArrowUp: () => move(0, step),
        ArrowDown: () => move(0, -step),
        "+": () => map.setZoom(map.getZoom() + 0.5),
        "=": () => map.setZoom(map.getZoom() + 0.5),
        "-": () => map.setZoom(map.getZoom() - 0.5),
        _: () => map.setZoom(map.getZoom() - 0.5),
        "0": onResetView,
        n: () => map.setBearing(0),
        N: () => map.setBearing(0),
      };
      const handler = handlers[event.key];
      if (handler === undefined) return;
      event.preventDefault();
      handler();
    },
    [mapRef, onSelect, onResetView, orders, setLiveMessage, setSelectedFleet],
  );
}
