import { describe, expect, it } from "vite-plus/test";

import { srgbToCanvasHex, DisplayColorError } from "./display-color.js";

describe("srgbToCanvasHex", () => {
  it("keeps neutrals", () => {
    expect(srgbToCanvasHex("#000000")).toBe("#000000");
    expect(srgbToCanvasHex("#ffffff")).toBe("#ffffff");
    expect(srgbToCanvasHex("#808080")).toBe("#808080");
  });

  it("lifts the red of a saturated cyan for a canvas read in a wider gamut", () => {
    expect(srgbToCanvasHex("#00cce0")).toBe("#72c7dd");
  });

  it("moves a pale mint", () => {
    expect(srgbToCanvasHex("#94e8d4")).toBe("#b0e5d5");
  });

  it("rejects anything but a six digit hex colour", () => {
    expect(() => srgbToCanvasHex("#fff")).toThrow(DisplayColorError);
    expect(() => srgbToCanvasHex("teal")).toThrow(DisplayColorError);
  });
});
