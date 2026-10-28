import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { GlobeAdapter } from "./GlobeAdapter.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";
import type { MapOrders } from "../world-map/map-orders.js";
import { nationHomeArea } from "../../content/presentationContent.js";
import { fakeMap as fake, type FakeMap } from "./fake-maplibre.js";

vi.mock("maplibre-gl", async () => {
  const { FakeMapClass } = await import("./fake-maplibre.js");
  return {
    Map: FakeMapClass,
    addProtocol: () => undefined,
    removeProtocol: () => undefined,
    setWorkerUrl: () => undefined,
  };
});

vi.mock("../globe-spike/use-land-plan.js", async () => {
  const { fakeManifest } = await import("./fake-maplibre.js");
  const tiles = {
    pack: {},
    manifest: fakeManifest,
    diagnostics: { requests: 0, served: 0, empty: 0, failures: [] },
  };
  const plan = { kind: "baked", tiles };
  return { useLandPlan: () => plan };
});

vi.mock("../globe-spike/map-container.js", async () => {
  const actual = await vi.importActual<typeof import("../globe-spike/map-container.js")>(
    "../globe-spike/map-container.js",
  );
  return { ...actual, hasRenderableSize: () => true };
});

const orders: MapOrders = {
  fleets: [
    {
      fleetId: "fleet-home",
      fleetName: "Home Fleet",
      areaId: "area_north_sea",
      mapAreaId: "area_north_sea",
      areaName: "North Sea",
      shipCount: 12,
      legalDestinations: [
        {
          areaId: "western-approaches",
          mapAreaId: "area_western_approaches",
          name: "Western Approaches",
        },
      ],
      blockedReason: null,
    },
  ],
  pending: [],
  blockadedMapAreas: new Set(),
  selectedFleetId: null,
  onSelectFleet: () => undefined,
  onDrop: () => undefined,
};

const overlay = {
  ...EMPTY_LIVE_OVERLAY,
  source: "campaign" as const,
  ownership: new Map([["area_north_sea", "united_kingdom"]]),
  lanes: [{ a: "area_north_sea", b: "area_western_approaches" }],
};

function renderAdapter(overrides: Partial<React.ComponentProps<typeof GlobeAdapter>> = {}) {
  return render(
    <GlobeAdapter
      state={{ ...initialMapPrototypeState, projection: "equirectangular" }}
      route={null}
      overlay={overlay}
      orders={orders}
      onSelect={() => undefined}
      onRuler={() => undefined}
      onToggleLayer={() => undefined}
      onSetProjection={() => undefined}
      onSetCentre={() => undefined}
      onUnavailable={() => undefined}
      {...overrides}
    />,
  );
}

async function readyMap(): Promise<FakeMap> {
  await waitFor(() => {
    expect(fake.instance).not.toBeNull();
    expect(fake.instance?.boxZoomDisabled).toBe(true);
    expect(fake.instance?.handlers.get("click")?.length ?? 0).toBeGreaterThan(0);
    expect(fake.instance?.handlers.get("mousemove")?.length ?? 0).toBeGreaterThan(0);
    expect(
      document
        .querySelector('[data-testid="globe-adapter"]')
        ?.getAttribute("data-globe-adapter-ready"),
    ).toBe("true");
  });
  return fake.instance as FakeMap;
}

describe("GlobeAdapter parity interactions", () => {
  beforeEach(() => {
    fake.instance = null;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("disables MapLibre box zoom so shift-click reaches the route reader", async () => {
    const onRuler = vi.fn();
    renderAdapter({ onRuler });
    const map = await readyMap();
    await waitFor(() => expect(map.handlers.get("click")?.length).toBe(1));
    map.areaHits = [{ properties: { id: "area_north_sea" } }];
    map.emit("click", {
      point: { x: 10, y: 10 },
      originalEvent: { shiftKey: true },
    });
    expect(onRuler).toHaveBeenCalledWith("area_north_sea");
  });

  it("selects a fleet marker instead of its area", async () => {
    const onSelectFleet = vi.fn();
    const onSelect = vi.fn();
    renderAdapter({
      onSelect,
      orders: { ...orders, onSelectFleet },
    });
    const map = await readyMap();
    map.markerHits = [
      {
        properties: {
          id: "fleet:fleet-home",
          markerClass: "fleet",
          areaId: "area_north_sea",
          name: "Home Fleet",
          lon: 3,
          lat: 56,
        },
      },
    ];
    map.emit("click", {
      point: { x: 10, y: 10 },
      originalEvent: { shiftKey: false },
    });
    expect(onSelectFleet).toHaveBeenCalledWith("fleet-home");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("drags a fleet to a legal area through the shared drop contract", async () => {
    const onDrop = vi.fn();
    const onSelectFleet = vi.fn();
    renderAdapter({ orders: { ...orders, onDrop, onSelectFleet } });
    const map = await readyMap();
    map.markerHits = [
      {
        properties: {
          id: "fleet:fleet-home",
          markerClass: "fleet",
          areaId: "area_north_sea",
          lon: 3,
          lat: 56,
        },
      },
    ];
    map.areaHits = [{ properties: { id: "area_western_approaches" } }];
    map.canvas.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 10, clientY: 10 }),
    );
    expect(onSelectFleet).toHaveBeenCalledWith("fleet-home");
    expect(map.dragPanCalls).toContain("disable");
    map.canvas.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: 20, clientY: 10 }),
    );
    map.canvas.dispatchEvent(
      new MouseEvent("pointerup", { bubbles: true, clientX: 20, clientY: 10 }),
    );
    expect(onDrop).toHaveBeenCalledWith("fleet-home", "area_western_approaches");
    expect(map.dragPanCalls).toContain("enable");
  });

  it("paints hover state and shows the area tooltip", async () => {
    renderAdapter();
    const map = await readyMap();
    map.areaHits = [{ properties: { id: "area_north_sea" } }];
    map.emit("mousemove", { point: { x: 30, y: 20 } });
    await waitFor(() => {
      expect(
        map.filterCalls.some(
          (call) =>
            call.id === "areas-hover" && JSON.stringify(call.value).includes("area_north_sea"),
        ),
      ).toBe(true);
    });
    expect(document.querySelector('[data-testid="globe-adapter-tooltip"]')?.textContent).toContain(
      "North Sea",
    );
  });

  it("focuses the home area on open and cycles fleets with f", async () => {
    const onSelectFleet = vi.fn();
    renderAdapter({
      initialFocusAreaId: nationHomeArea("united_kingdom"),
      initialFocusNationId: "united_kingdom",
      orders: { ...orders, onSelectFleet },
    });
    const map = await readyMap();
    await waitFor(() => expect(map.getCenter().lng).not.toBe(0));
    const application = document.querySelector('[role="application"]');
    expect(application).not.toBeNull();
    expect(fireEvent.keyDown(application as Element, { key: "f" })).toBe(false);
    expect(onSelectFleet).toHaveBeenCalledWith("fleet-home");
  });

  it("applies every layer toggle to its own layer", async () => {
    const { rerender } = renderAdapter();
    const map = await readyMap();
    rerender(
      <GlobeAdapter
        state={{
          ...initialMapPrototypeState,
          projection: "equirectangular",
          layers: {
            ...initialMapPrototypeState.layers,
            lanes: false,
          },
        }}
        route={null}
        overlay={overlay}
        orders={orders}
        onSelect={() => undefined}
        onRuler={() => undefined}
        onToggleLayer={() => undefined}
        onSetProjection={() => undefined}
        onSetCentre={() => undefined}
        onUnavailable={() => undefined}
      />,
    );
    await waitFor(() => {
      expect(fake.instance).not.toBeNull();
      expect(fake.instance).not.toBe(map);
    });
    const next = fake.instance as FakeMap;
    await waitFor(() => {
      expect(
        next.layoutCalls.some((call) => call.id === "adapter-lanes" && call.value === "none"),
      ).toBe(true);
      expect(
        next.layoutCalls.some(
          (call) => call.id === "adapter-graticule" && call.value === "visible",
        ),
      ).toBe(true);
    });
  });
});
