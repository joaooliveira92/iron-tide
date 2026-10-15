import { describe, expect, it } from "vite-plus/test";
import { hexToNormalizedRgb, normalizeHexColor } from "./shader-color.js";

describe("shader color", () => {
  it("canonicalizes a valid six-digit color", () => {
    expect(normalizeHexColor(" 0A10ff ", "#000000")).toBe("#0A10ff");
  });

  it("uses the supplied fallback for unsupported input", () => {
    expect(normalizeHexColor("not-a-color", "#123456")).toBe("#123456");
  });

  it("returns WebGL-normalized RGB components", () => {
    expect(hexToNormalizedRgb("#ff8000", "#000000")).toEqual([1, 128 / 255, 0]);
  });
});
