import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../lib/presentation-format/index.js";
import {
  TACTICAL_MAX_M_PER_PX,
  TACTICAL_MIN_M_PER_PX,
  clampMetersPerPixel,
  formatScale,
  lodBandFor,
  zoomMetersPerPixel,
} from "./tacticalScale.js";

/** The default presentation (en-US, Naval Credits) the scale readout renders under. */
const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

describe("tactical scale", () => {
  it("pins the documented limits: 1 px = 50 m .. 1,600 m (32x)", () => {
    expect(TACTICAL_MIN_M_PER_PX).toBe(50);
    expect(TACTICAL_MAX_M_PER_PX).toBe(1600);
    expect(TACTICAL_MAX_M_PER_PX / TACTICAL_MIN_M_PER_PX).toBe(32);
  });

  it("clamps out-of-range and non-finite values", () => {
    expect(clampMetersPerPixel(10)).toBe(50);
    expect(clampMetersPerPixel(5000)).toBe(1600);
    expect(clampMetersPerPixel(400)).toBe(400);
    expect(clampMetersPerPixel(Number.NaN)).toBe(1600);
  });

  it("zooms in by factor >1 (fewer metres per pixel) and respects the clamp", () => {
    expect(zoomMetersPerPixel(800, 2)).toBe(400);
    expect(zoomMetersPerPixel(60, 4)).toBe(50);
    expect(zoomMetersPerPixel(1000, 0.1)).toBe(1600);
  });

  it("selects LOD bands", () => {
    expect(lodBandFor(1600)).toBe("symbols");
    expect(lodBandFor(800)).toBe("symbols");
    expect(lodBandFor(400)).toBe("hulls");
    expect(lodBandFor(101)).toBe("hulls");
    expect(lodBandFor(100)).toBe("detail");
    expect(lodBandFor(50)).toBe("detail");
  });

  it("formats the HUD scale", () => {
    expect(formatScale(50, FORMAT)).toBe("1 px = 50 m");
    expect(formatScale(1600, FORMAT)).toBe("1 px = 1,600 m");
  });
});
