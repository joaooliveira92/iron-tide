import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { WorldMapChart, type WorldMapChartProps } from "./WorldMapChart.js";
import type { LiveWorldMapOverlay } from "./campaign-map-join.js";
import type { MapOrderFleet, MapOrders } from "./map-orders.js";
import { initialMapPrototypeState } from "./map-state.js";

const noop = () => undefined;

const overlay: LiveWorldMapOverlay = {
  source: "campaign",
  ownership: new Map([
    ["area_north_sea", "uk"],
    ["area_western_approaches", "uk"],
  ]),
  fleets: [
    { id: "home-fleet", name: "Home Fleet", area: "area_north_sea", nation: "uk", ships: 12 },
  ],
  ports: [],
  lanes: [],
  campaignAreas: [
    { id: "sea_north_sea", name: "North Sea", controller: "uk", fleets: [] },
    { id: "sea_western_approaches", name: "Western Approaches", controller: "uk", fleets: [] },
  ],
  playerNationId: "uk",
};

function fleet(id: string, mapAreaId: string | null): MapOrderFleet {
  return {
    fleetId: id,
    fleetName: id,
    areaId: "sea_north_sea",
    mapAreaId,
    areaName: "North Sea",
    shipCount: 4,
    legalDestinations: [
      {
        areaId: "sea_western_approaches",
        mapAreaId: "area_western_approaches",
        name: "Western Approaches",
      },
    ],
    blockedReason: null,
  };
}

function orders(patch: Partial<MapOrders> = {}): MapOrders {
  return {
    fleets: [fleet("home-fleet", "area_north_sea")],
    pending: [],
    blockadedMapAreas: new Set(),
    selectedFleetId: null,
    onSelectFleet: noop,
    onDrop: noop,
    ...patch,
  };
}

function mount(props: Partial<WorldMapChartProps> = {}) {
  return render(
    <WorldMapChart
      state={initialMapPrototypeState}
      route={null}
      onSelect={noop}
      onRuler={noop}
      onToggleLayer={noop}
      onSetProjection={noop}
      onSetCentre={noop}
      overlay={overlay}
      {...props}
    />,
  );
}

describe("WorldMapChart interaction", () => {
  beforeAll(() => {
    if (typeof window.PointerEvent === "undefined") {
      class TestPointerEvent extends MouseEvent {
        readonly pointerId: number;
        constructor(type: string, init: PointerEventInit = {}) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      }
      Object.defineProperty(window, "PointerEvent", {
        value: TestPointerEvent,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("clears the selection on Escape", () => {
    const onSelect = vi.fn();
    mount({ onSelect });
    const map = screen.getByRole("application");
    expect(fireEvent.keyDown(map, { key: "Escape" })).toBe(false);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("cycles the selected fleet with F and wraps around", () => {
    const onSelectFleet = vi.fn();
    const fleets = [fleet("alpha", "area_north_sea"), fleet("beta", null)];
    const view = mount({ orders: orders({ fleets, selectedFleetId: "alpha", onSelectFleet }) });
    expect(fireEvent.keyDown(screen.getByRole("application"), { key: "f" })).toBe(false);
    expect(onSelectFleet).toHaveBeenLastCalledWith("beta");
    view.rerender(
      <WorldMapChart
        state={initialMapPrototypeState}
        route={null}
        onSelect={noop}
        onRuler={noop}
        onToggleLayer={noop}
        onSetProjection={noop}
        onSetCentre={noop}
        overlay={overlay}
        orders={orders({ fleets, selectedFleetId: "beta", onSelectFleet })}
      />,
    );
    fireEvent.keyDown(screen.getByRole("application"), { key: "F" });
    expect(onSelectFleet).toHaveBeenLastCalledWith("alpha");
  });

  it("leaves F alone when no orders are wired", () => {
    mount();
    expect(fireEvent.keyDown(screen.getByRole("application"), { key: "f" })).toBe(true);
  });

  it("ignores navigation keys that carry a modifier", () => {
    mount();
    const map = screen.getByRole("application");
    expect(fireEvent.keyDown(map, { key: "ArrowLeft", ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(map, { key: "0", metaKey: true })).toBe(true);
  });

  it("routes a plain area click to select and a shift-click to the ruler", () => {
    const onSelect = vi.fn();
    const onRuler = vi.fn();
    const { container } = mount({ onSelect, onRuler });
    const area = container.querySelector('path[data-map-area="area_north_sea"]');
    expect(area).not.toBeNull();
    if (area === null) return;
    fireEvent.click(area);
    expect(onSelect).toHaveBeenLastCalledWith("area_north_sea");
    expect(onRuler).not.toHaveBeenCalled();
    fireEvent.click(area, { shiftKey: true });
    expect(onRuler).toHaveBeenLastCalledWith("area_north_sea");
  });

  function dragFleet(container: HTMLElement, travel: number, target: Element | null) {
    const svg = screen.getByRole("application");
    Object.assign(svg, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });
    Object.defineProperty(document, "elementsFromPoint", {
      value: () => (target === null ? [] : [target]),
      configurable: true,
    });
    const marker = container.querySelector('[data-map-fleet="home-fleet"]');
    expect(marker).not.toBeNull();
    if (marker === null) return;
    fireEvent.pointerDown(marker, { button: 0, pointerId: 7, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(svg, { pointerId: 7, clientX: 10 + travel, clientY: 10 });
    fireEvent.pointerUp(svg, { pointerId: 7, clientX: 10 + travel, clientY: 10 });
  }

  it("selects the fleet on pointer down and drops it on the area under the pointer after a drag", () => {
    const onDrop = vi.fn();
    const onSelectFleet = vi.fn();
    const { container } = mount({ orders: orders({ onDrop, onSelectFleet }) });
    const destination = container.querySelector('path[data-map-area="area_western_approaches"]');
    dragFleet(container, 40, destination);
    expect(onSelectFleet).toHaveBeenCalledWith("home-fleet");
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith("home-fleet", "area_western_approaches");
  });

  it("does not drop when the pointer moved less than the drag threshold", () => {
    const onDrop = vi.fn();
    const { container } = mount({ orders: orders({ onDrop }) });
    const destination = container.querySelector('path[data-map-area="area_western_approaches"]');
    dragFleet(container, 3, destination);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("does not drop when released over no area", () => {
    const onDrop = vi.fn();
    const { container } = mount({ orders: orders({ onDrop }) });
    dragFleet(container, 40, null);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("does not start a drag from a fleet that has no legal destination", () => {
    const onDrop = vi.fn();
    const onSelectFleet = vi.fn();
    const stuck: MapOrderFleet = {
      ...fleet("home-fleet", "area_north_sea"),
      legalDestinations: [],
    };
    const { container } = mount({ orders: orders({ fleets: [stuck], onDrop, onSelectFleet }) });
    const marker = container.querySelector('[data-map-fleet="home-fleet"]');
    if (marker === null) return;
    fireEvent.pointerDown(marker, { button: 0, pointerId: 7, clientX: 10, clientY: 10 });
    expect(onSelectFleet).not.toHaveBeenCalled();
  });
});
