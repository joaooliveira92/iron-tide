import { renderHook } from "@testing-library/react";
import { Map as MapLibreMap } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";
import { OverlayStore } from "./overlay-store.js";
import { useOverlayProjection, type OverlayProjectionInput } from "./use-overlay-projection.js";

vi.mock("maplibre-gl", async () => {
  const { FakeMapClass } = await import("./fake-maplibre.js");
  return { Map: FakeMapClass };
});

const overlay = {
  ...EMPTY_LIVE_OVERLAY,
  source: "campaign" as const,
  ports: [
    {
      id: "p1",
      name: "Portsmouth",
      area: "area_north_sea",
      nation: "united_kingdom",
      anchor: [1, 51] as const,
      level: 1,
    },
  ],
};

function store() {
  const instance = new OverlayStore();
  const replace = vi.spyOn(instance, "replace");
  return { instance, replace };
}

function inputs(
  overrides: Partial<OverlayProjectionInput> & {
    readonly map?: MapLibreMap | null;
    readonly store?: OverlayStore | null;
  },
): OverlayProjectionInput {
  const mapRef: MutableRefObject<MapLibreMap | null> = {
    current:
      overrides.map === undefined
        ? new MapLibreMap({ container: document.createElement("div") })
        : overrides.map,
  };
  const storeRef: MutableRefObject<OverlayStore | null> = {
    current: overrides.store === undefined ? new OverlayStore() : overrides.store,
  };
  return {
    mapRef,
    storeRef,
    ready: true,
    overlay,
    state: initialMapPrototypeState,
    route: null,
    orders: undefined,
    ...overrides,
  };
}

describe("useOverlayProjection", () => {
  it("replaces the store contents with the projected features once ready", () => {
    const { instance, replace } = store();
    renderHook(() => useOverlayProjection(inputs({ store: instance })));
    expect(replace).toHaveBeenCalledTimes(1);
    const features = replace.mock.calls[0]?.[0] ?? [];
    expect(features.map((feature) => feature.id)).toContain("port:p1");
  });

  it("never touches the store before the map is ready", () => {
    const { instance, replace } = store();
    renderHook(() => useOverlayProjection(inputs({ store: instance, ready: false })));
    expect(replace).not.toHaveBeenCalled();
  });

  it("does nothing without a map or without a store", () => {
    const { instance, replace } = store();
    renderHook(() => useOverlayProjection(inputs({ store: instance, map: null })));
    expect(replace).not.toHaveBeenCalled();
    expect(() => renderHook(() => useOverlayProjection(inputs({ store: null })))).not.toThrow();
  });

  it("projects again when readiness flips and when the state identity changes", () => {
    const { instance, replace } = store();
    const base = inputs({ store: instance, ready: false });
    const { rerender } = renderHook(
      (props: OverlayProjectionInput) => useOverlayProjection(props),
      {
        initialProps: base,
      },
    );
    expect(replace).not.toHaveBeenCalled();
    rerender({ ...base, ready: true });
    expect(replace).toHaveBeenCalledTimes(1);
    rerender({ ...base, ready: true });
    expect(replace).toHaveBeenCalledTimes(1);
    rerender({ ...base, ready: true, state: { ...initialMapPrototypeState } });
    expect(replace).toHaveBeenCalledTimes(2);
  });

  it("reflects a changed overlay in the projected features", () => {
    const { instance, replace } = store();
    const base = inputs({ store: instance });
    const { rerender } = renderHook(
      (props: OverlayProjectionInput) => useOverlayProjection(props),
      {
        initialProps: base,
      },
    );
    rerender({ ...base, overlay: EMPTY_LIVE_OVERLAY });
    const last = replace.mock.calls.at(-1)?.[0] ?? [];
    expect(last.map((feature) => feature.id)).not.toContain("port:p1");
  });
});
