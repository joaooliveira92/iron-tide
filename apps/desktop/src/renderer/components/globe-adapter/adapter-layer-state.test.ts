import { describe, expect, it } from "vite-plus/test";
import {
  adapterLayerVisibility,
  adapterProjectionFromApp,
  appProjectionFromAdapter,
  buildBorderCollection,
  buildGraticuleCollection,
  markerFilter,
  minimapToLatitude,
  minimapToLongitude,
  minimapViewportRect,
  overlayClassFilter,
  ownershipPaintValues,
  scaleBarForZoom,
} from "./adapter-layer-state.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";

describe("adapter layer state", () => {
  it("maps every Overview layer toggle and keeps the graticule always on", () => {
    const visibility = adapterLayerVisibility({
      ...initialMapPrototypeState.layers,
      ownership: false,
      fleets: false,
      lanes: false,
    });
    expect(visibility).toMatchObject({
      ownership: false,
      borders: true,
      lanes: false,
      possessions: true,
      fleets: false,
      labels: true,
      routes: true,
      graticule: true,
    });
  });

  it("maps the two application projections deterministically", () => {
    expect(adapterProjectionFromApp("miller")).toBe("globe");
    expect(adapterProjectionFromApp("equirectangular")).toBe("mercator");
    expect(appProjectionFromAdapter("globe")).toBe("miller");
    expect(appProjectionFromAdapter("mercator")).toBe("equirectangular");
  });

  it("filters markers by their individual layer toggle", () => {
    const both = adapterLayerVisibility(initialMapPrototypeState.layers);
    expect(markerFilter(both)).toEqual([
      "any",
      ["==", ["get", "markerClass"], "port"],
      ["==", ["get", "markerClass"], "fleet"],
      ["==", ["get", "markerClass"], "alert"],
    ]);
    const noPorts = markerFilter({ ...both, possessions: false });
    expect(noPorts).toEqual([
      "any",
      ["==", ["get", "markerClass"], "fleet"],
      ["==", ["get", "markerClass"], "alert"],
    ]);
    const none = markerFilter({ ...both, possessions: false, fleets: false });
    expect(none).toEqual(["==", ["get", "id"], "__none__"]);
  });

  it("separates static sea lanes from routes", () => {
    expect(overlayClassFilter("lane")).toEqual(["==", ["get", "overlayClass"], "lane"]);
    expect(overlayClassFilter("route")).toEqual(["==", ["get", "overlayClass"], "route"]);
  });

  it("builds closed 1880 border polygons and a complete graticule", () => {
    const borders = buildBorderCollection();
    expect(borders.features.length).toBeGreaterThanOrEqual(10);
    for (const feature of borders.features) {
      expect(feature.geometry.type).toBe("MultiPolygon");
      if (feature.geometry.type !== "MultiPolygon") continue;
      for (const polygon of feature.geometry.coordinates) {
        for (const ring of polygon) {
          expect(ring[0]).toEqual(ring[ring.length - 1]);
          expect(ring.length).toBeGreaterThanOrEqual(4);
        }
      }
    }
    const graticule = buildGraticuleCollection();
    const meridians = graticule.features.filter(
      (feature) => feature.properties?.kind === "meridian",
    );
    const parallels = graticule.features.filter(
      (feature) => feature.properties?.kind === "parallel",
    );
    expect(meridians).toHaveLength(12);
    expect(parallels).toHaveLength(5);
  });

  it("dims ownership without hiding the area fill that drives picking", () => {
    const overlay = { ownership: new Map([["area_north_sea", "united_kingdom"]]) };
    expect(ownershipPaintValues(overlay, true).opacity).toBe(0.45);
    expect(ownershipPaintValues(overlay, false)).toEqual({ color: "#33473b", opacity: 0.12 });
  });

  it("keeps the minimap viewport inside the minimap and maps clicks back to geography", () => {
    const rect = minimapViewportRect({ centre: [0, 0], zoom: 2, bearing: 0, pitch: 0 }, 176, 88);
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.width).toBeLessThanOrEqual(176);
    expect(rect.height).toBeGreaterThan(0);
    expect(rect.height).toBeLessThanOrEqual(88);
    expect(minimapToLongitude(0, 176)).toBe(-180);
    expect(minimapToLongitude(176, 176)).toBe(180);
    expect(minimapToLatitude(0, 88)).toBe(90);
    expect(minimapToLatitude(88, 88)).toBe(-90);
  });

  it("produces a positive scale bar whose width never exceeds the budget", () => {
    for (const zoom of [0, 1, 2, 4, 6]) {
      const bar = scaleBarForZoom(zoom, 140);
      expect(bar.pixels).toBeGreaterThan(0);
      expect(bar.pixels).toBeLessThanOrEqual(140);
      expect(bar.nauticalMiles).toBeGreaterThan(0);
    }
  });
});
