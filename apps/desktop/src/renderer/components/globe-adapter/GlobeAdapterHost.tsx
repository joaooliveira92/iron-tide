import { lazy, Suspense, useEffect, useState } from "react";

import { AREAS } from "../world-map/map-geometry.js";
import { EMPTY_LIVE_OVERLAY, type LiveWorldMapOverlay } from "../world-map/campaign-map-join.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";
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

export function GlobeAdapterHost() {
  const [hash, setHash] = useState(() => window.location.hash);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      setFailed(false);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
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
          state={initialMapPrototypeState}
          route={null}
          overlay={demoOverlay()}
          onSelect={() => undefined}
          onRuler={() => undefined}
          onToggleLayer={() => undefined}
          onSetProjection={() => undefined}
          onSetCentre={() => undefined}
          variant="full"
          landMode={demoMode(hash)}
          forceFailure={hash === GLOBE_ADAPTER_DEMO_FAIL_HASH}
          onUnavailable={() => setFailed(true)}
        />
      </Suspense>
    </div>
  );
}
