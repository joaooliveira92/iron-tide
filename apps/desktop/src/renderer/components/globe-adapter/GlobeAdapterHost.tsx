import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { AREAS } from "../world-map/map-geometry.js";
import { EMPTY_LIVE_OVERLAY, type LiveWorldMapOverlay } from "../world-map/campaign-map-join.js";
import {
  initialMapPrototypeState,
  pushRuler,
  readRoute,
  selectArea,
  toggleLayer,
  type MapPrototypeState,
} from "../world-map/map-state.js";
import type { MapOrders } from "../world-map/map-orders.js";
import { GLOBE_ADAPTER_ENABLED } from "./globe-adapter-flag.js";

export const GLOBE_ADAPTER_DEMO_HASH = "#globe-adapter-demo";
export const GLOBE_ADAPTER_DEMO_FAIL_HASH = "#globe-adapter-demo-fail";
export const GLOBE_ADAPTER_DEMO_MISSING_HASH = "#globe-adapter-demo-missing";
export const GLOBE_ADAPTER_DEMO_CORRUPT_HASH = "#globe-adapter-demo-corrupt";

function demoMode(hash: string): "baked" | "missing" | "corrupt" {
  if (hash === GLOBE_ADAPTER_DEMO_MISSING_HASH) return "missing";
  if (hash === GLOBE_ADAPTER_DEMO_CORRUPT_HASH) return "corrupt";
  return "baked";
}

const GlobeAdapter = GLOBE_ADAPTER_ENABLED
  ? lazy(() => import("./GlobeAdapter.js").then((module) => ({ default: module.GlobeAdapter })))
  : null;

function demoOverlay(): LiveWorldMapOverlay {
  const areas = AREAS.slice(0, 6);
  return {
    ...EMPTY_LIVE_OVERLAY,
    source: "campaign",
    ports: areas.slice(0, 3).map((area, index) => ({
      id: `demo-port-${index + 1}`,
      name: area.short,
      area: area.id,
      nation: "demo-nation",
      level: index === 0 ? 8 : 4,
    })),
    fleets: areas.slice(3, 6).map((area, index) => ({
      id: `demo-fleet-${index + 1}`,
      name: `Demo fleet ${index + 1}`,
      area: area.id,
      nation: "demo-nation",
      ships: index + 2,
    })),
    lanes: areas.slice(0, 5).map((area, index) => ({
      a: area.id,
      b: (areas[index + 1] ?? areas[0] ?? area).id,
    })),
  };
}

function demoOrders(
  overlay: LiveWorldMapOverlay,
  selectedFleetId: string | null,
  onSelectFleet: (fleetId: string) => void,
  onDrop: (fleetId: string, mapAreaId: string) => void,
): MapOrders {
  const fleets = overlay.fleets ?? [];
  return {
    fleets: fleets.map((fleet) => {
      const destination = AREAS.find((area) => area.id !== fleet.area) ?? AREAS[0];
      return {
        fleetId: fleet.id,
        fleetName: fleet.name,
        areaId: fleet.area,
        mapAreaId: fleet.area,
        areaName: fleet.area,
        shipCount: fleet.ships,
        legalDestinations:
          destination === undefined
            ? []
            : [
                {
                  areaId: destination.id,
                  mapAreaId: destination.id,
                  name: destination.short,
                },
              ],
        blockedReason: null,
      };
    }),
    pending: [],
    blockadedMapAreas: new Set(),
    selectedFleetId,
    onSelectFleet,
    onDrop,
  };
}

declare global {
  interface Window {
    __globeAdapterDemo?: {
      readonly selectedFleetId: string | null;
      readonly lastDrop: string | null;
      readonly areas: readonly string[];
      readonly legalDestinations: Readonly<Record<string, string | null>>;
    };
  }
}

export function GlobeAdapterHost() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [failed, setFailed] = useState(false);
  const overlay = useMemo(demoOverlay, []);
  const [state, setState] = useState<MapPrototypeState>(initialMapPrototypeState);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [lastDrop, setLastDrop] = useState<string | null>(null);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      setFailed(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.demoSelectedFleet = selectedFleetId ?? "";
    document.documentElement.dataset.demoDrop = lastDrop ?? "";
  }, [selectedFleetId, lastDrop]);
  useEffect(() => {
    window.__globeAdapterDemo = {
      selectedFleetId,
      lastDrop,
      areas: AREAS.slice(0, 6).map((area) => area.id),
      legalDestinations: Object.fromEntries(
        (overlay.fleets ?? []).map((fleet) => {
          const destination = AREAS.find((area) => area.id !== fleet.area);
          return [fleet.id, destination?.id ?? null];
        }),
      ),
    };
  }, [overlay, selectedFleetId, lastDrop]);
  const orders = useMemo(
    () =>
      demoOrders(overlay, selectedFleetId, setSelectedFleetId, (fleetId, areaId) =>
        setLastDrop(`${fleetId}->${areaId}`),
      ),
    [overlay, selectedFleetId],
  );
  const onSelect = useCallback(
    (id: string | null) => setState((current) => selectArea(current, id)),
    [],
  );
  const onRuler = useCallback((id: string) => setState((current) => pushRuler(current, id)), []);
  const onToggleLayer = useCallback(
    (layer: Parameters<typeof toggleLayer>[1]) =>
      setState((current) => toggleLayer(current, layer)),
    [],
  );
  const onSetProjection = useCallback(
    (projection: MapPrototypeState["projection"]) =>
      setState((current) => ({ ...current, projection })),
    [],
  );
  const onSetCentre = useCallback(
    (centre: number) => setState((current) => ({ ...current, centre })),
    [],
  );
  const onUnavailable = useCallback(() => setFailed(true), []);
  const requested =
    hash === GLOBE_ADAPTER_DEMO_HASH ||
    hash === GLOBE_ADAPTER_DEMO_FAIL_HASH ||
    hash === GLOBE_ADAPTER_DEMO_MISSING_HASH ||
    hash === GLOBE_ADAPTER_DEMO_CORRUPT_HASH;
  if (!GLOBE_ADAPTER_ENABLED || !requested || failed || GlobeAdapter === null) return null;
  return (
    <div className="fixed inset-0 z-[9999]">
      <Suspense fallback={null}>
        <GlobeAdapter
          state={state}
          route={readRoute(state, overlay.lanes ?? [])}
          overlay={overlay}
          orders={orders}
          onSelect={onSelect}
          onRuler={onRuler}
          onToggleLayer={onToggleLayer}
          onSetProjection={onSetProjection}
          onSetCentre={onSetCentre}
          variant="full"
          landMode={demoMode(hash)}
          forceFailure={hash === GLOBE_ADAPTER_DEMO_FAIL_HASH}
          onUnavailable={onUnavailable}
        />
      </Suspense>
    </div>
  );
}
