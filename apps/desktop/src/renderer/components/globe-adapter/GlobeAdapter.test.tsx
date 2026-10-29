import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(fake.instance?.keyboardDisabled).toBe(true);
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
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
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

  it("disables MapLibre's own keyboard handler to avoid double panning", async () => {
    renderAdapter();
    const map = await readyMap();
    expect(map.keyboardDisabled).toBe(true);
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
            ownership: false,
            borders: false,
            lanes: false,
            possessions: false,
            fleets: false,
            labels: false,
            routes: false,
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
      for (const id of [
        "adapter-borders-fill",
        "adapter-borders-line",
        "adapter-lanes",
        "adapter-routes",
      ]) {
        expect(next.layoutCalls.some((call) => call.id === id && call.value === "none")).toBe(true);
      }
      expect(
        next.layoutCalls.some(
          (call) => call.id === "adapter-graticule" && call.value === "visible",
        ),
      ).toBe(true);
      expect(
        next.filterCalls.some(
          (call) =>
            call.id === "adapter-markers" && JSON.stringify(call.value).includes("__none__"),
        ),
      ).toBe(true);
      expect(
        next.filterCalls.some(
          (call) =>
            call.id === "adapter-marker-labels" && JSON.stringify(call.value).includes("__none__"),
        ),
      ).toBe(true);
    });
  });

  it("ignores an illegal fleet drop and restores drag pan on cancel", async () => {
    const onDrop = vi.fn();
    renderAdapter({ orders: { ...orders, onDrop } });
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
    map.areaHits = [{ properties: { id: "area_baltic" } }];
    fireEvent.pointerDown(map.canvas, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(map.canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(map.canvas, { clientX: 20, clientY: 10, pointerId: 1 });
    expect(onDrop).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId("globe-adapter-live").textContent).toContain("not available"),
    );
    expect(map.dragPanCalls).toContain("enable");

    fireEvent.pointerDown(map.canvas, { button: 0, clientX: 10, clientY: 10, pointerId: 2 });
    fireEvent.pointerMove(map.canvas, { clientX: 20, clientY: 10, pointerId: 2 });
    fireEvent.pointerCancel(map.canvas, { pointerId: 2 });
    expect(onDrop).not.toHaveBeenCalled();
    expect(map.dragPanCalls.filter((call) => call === "enable").length).toBeGreaterThanOrEqual(2);
  });

  it("writes projection changes through the application contract and fits on reset", async () => {
    const onSetProjection = vi.fn();
    renderAdapter({ onSetProjection });
    const map = await readyMap();
    fireEvent.click(screen.getByRole("button", { name: "Globe" }));
    expect(onSetProjection).toHaveBeenCalledWith("miller");
    expect(map.projectionCalls).toContainEqual({ type: "globe" });
    map.setZoom(8);
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(map.getZoom()).toBeLessThan(8);
  });

  it("handles keyboard pan, zoom, north, reset and escape", async () => {
    const onSelect = vi.fn();
    renderAdapter({ onSelect });
    const map = await readyMap();
    const application = document.querySelector('[role="application"]') as Element;
    fireEvent.keyDown(application, { key: "ArrowLeft" });
    expect(map.panByCalls).toHaveLength(1);
    fireEvent.keyDown(application, { key: "+" });
    expect(map.getZoom()).toBe(2.5);
    fireEvent.keyDown(application, { key: "n" });
    expect(map.bearingCalls.length).toBeGreaterThan(0);
    fireEvent.keyDown(application, { key: "Escape" });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("honours reduced motion for keyboard panning", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: () => ({
        matches: true,
        media: "",
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
    renderAdapter();
    const map = await readyMap();
    const application = document.querySelector('[role="application"]') as Element;
    fireEvent.keyDown(application, { key: "ArrowLeft" });
    expect(map.panOptions[0]).toMatchObject({ animate: false, duration: 0 });
  });

  it("exposes the selected variant on the adapter root", async () => {
    renderAdapter({ variant: "command" });
    await readyMap();
    const root = screen.getByTestId("globe-adapter");
    expect(root.getAttribute("data-map-variant")).toBe("command");
    expect(root.className).not.toContain("fixed");
  });

  it("leaves the sea-area divisions out of the command variant", async () => {
    renderAdapter({ variant: "command" });
    await readyMap();
    expect(screen.queryByTestId("globe-adapter-area-list")).toBeNull();
  });

  it("reaches the layers and ports lists from header toolbar buttons in the command variant", async () => {
    renderAdapter({ variant: "command" });
    await readyMap();
    expect(screen.queryByTestId("globe-adapter-entities")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ports and fleets/ }));
    expect(await screen.findByTestId("globe-adapter-entities")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Layers & areas/ })).toBeTruthy();
  });

  it("keeps the sea-area list in the full variant", async () => {
    renderAdapter({ variant: "full" });
    await readyMap();
    expect(screen.getByTestId("globe-adapter-area-list")).toBeTruthy();
  });
});
