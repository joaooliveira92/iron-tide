import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { formatNauticalMiles, niceScaleBar, pixelsPerNauticalMile } from "./map-scale.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

describe("pixelsPerNauticalMile", () => {
  it("is 360 deg x 60 nm across the world width at scale 1", () => {
    expect(pixelsPerNauticalMile(1, 1, 2160)).toBeCloseTo(0.1, 10);
  });

  it("scales linearly with camera zoom and screen pixels per unit", () => {
    expect(pixelsPerNauticalMile(2, 5, 2160)).toBeCloseTo(1, 10);
  });
});

describe("niceScaleBar", () => {
  it("picks a 1/2/5 x 10^n length that fits the max pixel width", () => {
    for (const pxPerNm of [0.02, 0.1, 0.37, 1, 8, 64, 400]) {
      const bar = niceScaleBar(pxPerNm, 140);
      expect(bar.px).toBeLessThanOrEqual(140);
      expect(bar.px).toBeGreaterThan(140 / 2.5 - 1);
      expect(/^[125]0*$/.test(String(bar.nm)) || bar.nm < 1).toBe(true);
    }
  });

  it("falls back to fractional nm (cables) at very deep zoom", () => {
    const bar = niceScaleBar(2000, 140);
    expect(bar.nm).toBeLessThan(1);
    expect(bar.px).toBeLessThanOrEqual(140);
  });

  it("returns an empty bar for a non-positive scale", () => {
    expect(niceScaleBar(0, 140)).toEqual({ nm: 0, px: 0 });
  });
});

describe("formatNauticalMiles", () => {
  it("formats whole, thousands and fractional values", () => {
    expect(formatNauticalMiles(5, FORMAT)).toBe("5 nm");
    expect(formatNauticalMiles(2000, FORMAT)).toBe("2,000 nm");
    expect(formatNauticalMiles(0.5, FORMAT)).toBe("0.5 nm");
    expect(formatNauticalMiles(0.1, FORMAT)).toBe("0.1 nm");
  });
});
