import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Map as MapLibreMap } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vite-plus/test";
import type { MapOrders } from "../world-map/map-orders.js";
import { useMapKeyboard } from "./use-map-keyboard.js";

vi.mock("maplibre-gl", async () => {
  const { FakeMapClass } = await import("./fake-maplibre.js");
  return { Map: FakeMapClass };
});

function stubReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => ({ matches, media: "" }),
  });
}

function orders(selectedFleetId: string | null, onSelectFleet: (id: string) => void): MapOrders {
  const fleet = (fleetId: string, mapAreaId: string | null) => ({
    fleetId,
    fleetName: `Fleet ${fleetId}`,
    areaId: "area_north_sea",
    mapAreaId,
    areaName: "North Sea",
    shipCount: 1,
    legalDestinations: [],
    blockedReason: null,
  });
  return {
    fleets: [fleet("a", "area_north_sea"), fleet("b", null)],
    pending: [],
    blockadedMapAreas: new Set(),
    selectedFleetId,
    onSelectFleet,
    onDrop: () => undefined,
  };
}

interface Spies {
  readonly onSelect: Mock<(area: string | null) => void>;
  readonly onResetView: Mock<() => void>;
  readonly setSelectedFleet: Mock<(fleetId: string | null) => void>;
  readonly setLiveMessage: Mock<(message: string) => void>;
}

function mountKeyboard(map: MapLibreMap | null, mapOrders: MapOrders | undefined): Spies {
  const spies: Spies = {
    onSelect: vi.fn<(area: string | null) => void>(),
    onResetView: vi.fn<() => void>(),
    setSelectedFleet: vi.fn<(fleetId: string | null) => void>(),
    setLiveMessage: vi.fn<(message: string) => void>(),
  };
  const mapRef: MutableRefObject<MapLibreMap | null> = { current: map };
  function Harness() {
    const onKeyDown = useMapKeyboard({
      mapRef,
      orders: mapOrders,
      onSelect: spies.onSelect,
      onResetView: spies.onResetView,
      setSelectedFleet: spies.setSelectedFleet,
      setLiveMessage: spies.setLiveMessage,
    });
    return <div data-testid="surface" tabIndex={0} onKeyDown={onKeyDown} />;
  }
  render(<Harness />);
  return spies;
}

function press(key: string, init: Partial<KeyboardEventInit> = {}): boolean {
  return fireEvent.keyDown(screen.getByTestId("surface"), { key, ...init });
}

function newMap(): MapLibreMap {
  return new MapLibreMap({ container: document.createElement("div") });
}

describe("useMapKeyboard", () => {
  beforeEach(() => stubReducedMotion(false));
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("pans by 120 px per arrow and 240 px with shift, inverting the map direction", () => {
    const map = newMap();
    const panBy = vi.spyOn(map, "panBy");
    mountKeyboard(map, undefined);
    press("ArrowLeft");
    press("ArrowRight");
    press("ArrowUp");
    press("ArrowDown", { shiftKey: true });
    expect(panBy.mock.calls.map(([offset]) => offset)).toEqual([
      [120, 0],
      [-120, 0],
      [0, 120],
      [0, -240],
    ]);
    expect(panBy.mock.calls[0]?.[1]).toEqual({ animate: true, duration: 250 });
  });

  it("pans without animation under reduced motion", () => {
    stubReducedMotion(true);
    const map = newMap();
    const panBy = vi.spyOn(map, "panBy");
    mountKeyboard(map, undefined);
    press("ArrowLeft");
    expect(panBy.mock.calls[0]?.[1]).toEqual({ animate: false, duration: 0 });
  });

  it("zooms by half a level for plus, equals, minus and underscore", () => {
    const map = newMap();
    const setZoom = vi.spyOn(map, "setZoom");
    mountKeyboard(map, undefined);
    press("+");
    press("=");
    press("-");
    press("_");
    expect(setZoom.mock.calls.map(([zoom]) => zoom)).toEqual([2.5, 3, 2.5, 2]);
  });

  it("resets the view on zero and points north on n or N", () => {
    const map = newMap();
    const setBearing = vi.spyOn(map, "setBearing");
    const spies = mountKeyboard(map, undefined);
    press("0");
    press("n");
    press("N");
    expect(spies.onResetView).toHaveBeenCalledTimes(1);
    expect(setBearing.mock.calls).toEqual([[0], [0]]);
  });

  it("prevents default only for handled keys", () => {
    mountKeyboard(newMap(), undefined);
    expect(press("ArrowLeft")).toBe(false);
    expect(press("x")).toBe(true);
  });

  it("clears fleet and area selection on Escape", () => {
    const spies = mountKeyboard(newMap(), undefined);
    expect(press("Escape")).toBe(false);
    expect(spies.setSelectedFleet).toHaveBeenCalledWith(null);
    expect(spies.onSelect).toHaveBeenCalledWith(null);
  });

  it("lets modifier chords skip f and Escape but still handles movement keys", () => {
    const map = newMap();
    const panBy = vi.spyOn(map, "panBy");
    const onSelectFleet = vi.fn();
    const spies = mountKeyboard(map, orders(null, onSelectFleet));
    press("f", { ctrlKey: true });
    press("Escape", { metaKey: true });
    press("F", { altKey: true });
    expect(onSelectFleet).not.toHaveBeenCalled();
    expect(spies.onSelect).not.toHaveBeenCalled();
    press("ArrowLeft", { ctrlKey: true });
    expect(panBy).toHaveBeenCalledTimes(1);
  });

  it("acts on f and Escape without a map and ignores every other key", () => {
    const onSelectFleet = vi.fn();
    const spies = mountKeyboard(null, orders(null, onSelectFleet));
    press("ArrowLeft");
    press("0");
    expect(spies.onResetView).not.toHaveBeenCalled();
    press("f");
    expect(onSelectFleet).toHaveBeenCalledWith("a");
    press("Escape");
    expect(spies.onSelect).toHaveBeenCalledWith(null);
  });

  it("cycles fleets, wrapping, zooming to at least 3.5 on a mapped area and announcing", () => {
    const map = newMap();
    const jumpTo = vi.spyOn(map, "jumpTo");
    const onSelectFleet = vi.fn();
    const spies = mountKeyboard(map, orders("b", onSelectFleet));
    press("F");
    expect(onSelectFleet).toHaveBeenCalledWith("a");
    expect(spies.setSelectedFleet).toHaveBeenCalledWith("a");
    expect(spies.setLiveMessage).toHaveBeenCalledWith("Focused fleet Fleet a");
    expect(jumpTo).toHaveBeenCalledTimes(1);
    expect(jumpTo.mock.calls[0]?.[0]).toMatchObject({ zoom: 3.5 });
  });

  it("keeps a higher zoom and skips the jump for a fleet without a map area", () => {
    const map = newMap();
    map.setZoom(5);
    const jumpTo = vi.spyOn(map, "jumpTo");
    const onSelectFleet = vi.fn();
    const spies = mountKeyboard(map, orders("a", onSelectFleet));
    press("f");
    expect(onSelectFleet).toHaveBeenCalledWith("b");
    expect(jumpTo).not.toHaveBeenCalled();
    expect(spies.setLiveMessage).toHaveBeenCalledWith("Focused fleet Fleet b");
  });

  it("keeps a higher zoom when jumping to a mapped fleet", () => {
    const map = newMap();
    map.setZoom(5);
    const jumpTo = vi.spyOn(map, "jumpTo");
    mountKeyboard(map, orders("b", vi.fn()));
    press("f");
    expect(jumpTo.mock.calls[0]?.[0]).toMatchObject({ zoom: 5 });
  });

  it("does nothing on f when there are no fleets", () => {
    const spies = mountKeyboard(newMap(), undefined);
    press("f");
    expect(spies.setSelectedFleet).not.toHaveBeenCalled();
    expect(spies.setLiveMessage).not.toHaveBeenCalled();
  });
});
