import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { landStatus } from "./globe-spike-api.js";
import { centroid, entities, nextFrame } from "./globe-spike-entities.js";
import { SPIKE_MARKERS } from "./globe-spike-scene.js";
import { EMPTY, buildStyle, type ReadyPlan } from "./globe-spike-style.js";

const RUNTIME_PLAN: ReadyPlan = { kind: "runtime", coast: EMPTY, reason: null };

function contextReturning(
  data: Uint8ClampedArray,
  requested: Array<readonly [number, number, number, number]>,
) {
  return {
    getImageData: (x: number, y: number, w: number, h: number) => {
      requested.push([x, y, w, h]);
      return { data };
    },
  };
}

describe("globe spike entities", () => {
  it("lists every spike marker as a port", () => {
    expect(entities()).toEqual(
      SPIKE_MARKERS.map((marker) => ({ id: marker.id, name: marker.name, kind: "port" })),
    );
  });
});

describe("globe spike centroid", () => {
  it("returns the weighted centre of the red pixels", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let pixel = 0; pixel < 16; pixel++) data[pixel * 4] = 255;
    const requested: Array<readonly [number, number, number, number]> = [];
    const found = centroid(contextReturning(data, requested), 100, 100, 10, 20, 2);
    expect(requested).toEqual([[8, 18, 4, 4]]);
    expect(found).toEqual([10, 20]);
  });

  it("returns null when the red weight is below the noise floor", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let pixel = 0; pixel < 16; pixel++) data[pixel * 4] = 50;
    expect(centroid(contextReturning(data, []), 100, 100, 10, 20, 2)).toBeNull();
  });

  it("returns null without sampling when the window falls outside the canvas", () => {
    const requested: Array<readonly [number, number, number, number]> = [];
    const found = centroid(
      contextReturning(new Uint8ClampedArray(0), requested),
      10,
      10,
      50,
      50,
      2,
    );
    expect(found).toBeNull();
    expect(requested).toEqual([]);
  });
});

describe("globe spike nextFrame", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves on the next animation frame", async () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    let settled = false;
    const pending = nextFrame().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    callbacks[0]?.(0);
    await pending;
    expect(settled).toBe(true);
  });
});

describe("globe spike style", () => {
  it("builds a globe style with the runtime coastline and area sources", () => {
    const style = buildStyle(RUNTIME_PLAN);
    expect(style.projection).toEqual({ type: "globe" });
    expect(Object.keys(style.sources).sort()).toEqual([
      "areaLabels",
      "areas",
      "land",
      "markers",
      "probe",
      "routes",
    ]);
    expect(style.layers.map((layer) => layer.id)).toEqual([
      "ocean",
      "land",
      "areas-fill",
      "areas-line",
      "area-labels",
      "routes",
      "markers",
      "selected-ring",
      "marker-labels",
      "probe",
    ]);
    expect(style.sources.land).toMatchObject({ type: "geojson", maxzoom: 10, tolerance: 0.2 });
  });

  it("derives the glyph url from the document base", () => {
    const style = buildStyle(RUNTIME_PLAN);
    const base = document.baseURI.slice(0, document.baseURI.lastIndexOf("/") + 1);
    expect(style.glyphs).toBe(`${base}map-spike/glyphs/{fontstack}/{range}.pbf`);
  });
});

describe("globe spike land status", () => {
  it("reports the runtime plan with its fallback reason", () => {
    expect(landStatus({ kind: "runtime", coast: EMPTY, reason: "no pack" }, 3)).toEqual({
      source: "runtime",
      tileMaxZoom: null,
      fitForPurposeMaxZoom: null,
      overscaled: false,
      fallbackReason: "no pack",
    });
  });
});
