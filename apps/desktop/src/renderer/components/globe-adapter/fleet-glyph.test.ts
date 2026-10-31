import { describe, expect, it } from "vite-plus/test";

import { fleetGlyphFilter, adapterLayerVisibility } from "./adapter-layer-state.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";
import { buildFleetGlyph } from "./fleet-glyph.js";

function alphaAt(image: ReturnType<typeof buildFleetGlyph>, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4 + 3] as number;
}

describe("fleet glyph", () => {
  const image = buildFleetGlyph();

  it("is a square signed-distance image with a transparent border", () => {
    expect(image.width).toBe(image.height);
    expect(image.data).toHaveLength(image.width * image.height * 4);
    expect(alphaAt(image, 0, 0)).toBe(0);
    expect(alphaAt(image, image.width - 1, image.height - 1)).toBe(0);
  });

  it("is solid in the middle and half-way at the edge of the square", () => {
    const middle = image.width / 2;
    expect(alphaAt(image, middle, middle)).toBe(255);
    expect(alphaAt(image, middle, middle - 7)).toBeGreaterThan(200);
    const edge = alphaAt(image, middle, middle - 8);
    expect(edge).toBeGreaterThan(150);
    expect(edge).toBeLessThan(220);
    expect(alphaAt(image, middle, middle - 11)).toBeLessThan(edge);
  });

  it("has the same extent on both axes", () => {
    const middle = image.width / 2;
    for (let offset = 0; offset < 12; offset++) {
      expect(alphaAt(image, middle + offset, middle)).toBe(alphaAt(image, middle, middle + offset));
    }
  });
});

describe("fleetGlyphFilter", () => {
  it("shows only fleets while the fleets layer is on", () => {
    const on = adapterLayerVisibility({ ...initialMapPrototypeState.layers, fleets: true });
    expect(JSON.stringify(fleetGlyphFilter(on))).toContain("fleet");
    expect(JSON.stringify(fleetGlyphFilter(on))).not.toContain("__none__");
  });

  it("hides every glyph while the fleets layer is off", () => {
    const off = adapterLayerVisibility({ ...initialMapPrototypeState.layers, fleets: false });
    expect(JSON.stringify(fleetGlyphFilter(off))).toContain("__none__");
  });
});
