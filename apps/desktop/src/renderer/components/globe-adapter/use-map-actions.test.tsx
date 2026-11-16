import { renderHook } from "@testing-library/react";
import { Map as MapLibreMap } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { fitWorldCamera, type CameraProjection } from "./camera-contract.js";
import { useMapActions } from "./use-map-actions.js";

vi.mock("maplibre-gl", async () => {
  const { FakeMapClass } = await import("./fake-maplibre.js");
  return { Map: FakeMapClass };
});

function setup(map: MapLibreMap | null, projection: CameraProjection = "mercator", centre = 12) {
  const projectionRef: MutableRefObject<CameraProjection> = { current: projection };
  const setProjection = vi.fn();
  const onSetProjection = vi.fn();
  const onSetCentre = vi.fn();
  const mapRef: MutableRefObject<MapLibreMap | null> = { current: map };
  const hook = renderHook(() =>
    useMapActions({ mapRef, projectionRef, centre, setProjection, onSetProjection, onSetCentre }),
  );
  return { ...hook, projectionRef, setProjection, onSetProjection, onSetCentre };
}

function newMap(): MapLibreMap {
  return new MapLibreMap({ container: document.createElement("div") });
}

describe("useMapActions", () => {
  it("resets to the fitted world camera for the current projection around the app centre", () => {
    const map = newMap();
    const jumpTo = vi.spyOn(map, "jumpTo");
    const { result } = setup(map, "globe", 40);
    result.current.resetView();
    const fitted = fitWorldCamera("globe");
    expect(jumpTo).toHaveBeenCalledWith({
      center: [40, fitted.centre[1]],
      zoom: fitted.zoom,
      bearing: 0,
      pitch: 0,
    });
  });

  it("does not reset without a map", () => {
    const { result } = setup(null);
    expect(() => result.current.resetView()).not.toThrow();
  });

  it("reports the app projection, switches the map and mirrors local state", () => {
    const map = newMap();
    const setProjection = vi.spyOn(map, "setProjection");
    const { result, onSetProjection, setProjection: setLocal, projectionRef } = setup(map, "globe");
    result.current.handleSetProjection("equirectangular");
    expect(onSetProjection).toHaveBeenCalledWith("equirectangular");
    expect(setProjection).toHaveBeenCalledWith({ type: "mercator" });
    expect(setLocal).toHaveBeenCalledWith("mercator");
    expect(projectionRef.current).toBe("mercator");
  });

  it("maps the miller app projection to the globe adapter projection", () => {
    const map = newMap();
    const { result, projectionRef } = setup(map, "mercator");
    result.current.handleSetProjection("miller");
    expect(projectionRef.current).toBe("globe");
  });

  it("still reports the app projection but skips local state without a map", () => {
    const { result, onSetProjection, setProjection, projectionRef } = setup(null, "mercator");
    result.current.handleSetProjection("miller");
    expect(onSetProjection).toHaveBeenCalledWith("miller");
    expect(setProjection).not.toHaveBeenCalled();
    expect(projectionRef.current).toBe("mercator");
  });

  it("recentres the map and reports the longitude", () => {
    const map = newMap();
    const jumpTo = vi.spyOn(map, "jumpTo");
    const { result, onSetCentre } = setup(map);
    result.current.recentre(-30, 45);
    expect(jumpTo).toHaveBeenCalledWith({ center: [-30, 45] });
    expect(onSetCentre).toHaveBeenCalledWith(-30);
  });

  it("reports the longitude even without a map", () => {
    const { result, onSetCentre } = setup(null);
    result.current.recentre(10, 20);
    expect(onSetCentre).toHaveBeenCalledWith(10);
  });

  it("keeps action identities stable across rerenders with the same inputs", () => {
    const { result, rerender } = setup(newMap());
    const before = result.current;
    rerender();
    expect(result.current).toEqual(before);
    expect(result.current.resetView).toBe(before.resetView);
    expect(result.current.recentre).toBe(before.recentre);
  });
});
