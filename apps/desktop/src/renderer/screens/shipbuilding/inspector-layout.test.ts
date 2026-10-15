import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_INSPECTOR_LAYOUT,
  INSPECTOR_DEFAULT_PX,
  INSPECTOR_MAX_PX,
  INSPECTOR_MIN_PX,
  clampInspectorWidth,
  normalizeInspectorLayout,
} from "./inspector-layout.js";

describe("inspector layout", () => {
  it("clamps a dragged width to the supported range and rounds it", () => {
    expect(clampInspectorWidth(100)).toBe(INSPECTOR_MIN_PX);
    expect(clampInspectorWidth(999)).toBe(INSPECTOR_MAX_PX);
    expect(clampInspectorWidth(440.6)).toBe(441);
    expect(clampInspectorWidth(500)).toBe(500);
  });

  it("falls back to the default width for a non-finite value", () => {
    expect(clampInspectorWidth(Number.NaN)).toBe(INSPECTOR_DEFAULT_PX);
    expect(clampInspectorWidth(Number.POSITIVE_INFINITY)).toBe(INSPECTOR_DEFAULT_PX);
  });

  it("normalizes a stored layout, clamping the width and reading the collapsed flag", () => {
    expect(normalizeInspectorLayout({ widthPx: 999, collapsed: true })).toEqual({
      widthPx: INSPECTOR_MAX_PX,
      collapsed: true,
    });
  });

  it("defaults each field independently when one is missing or out of shape", () => {
    expect(normalizeInspectorLayout({ collapsed: true })).toEqual({
      widthPx: INSPECTOR_DEFAULT_PX,
      collapsed: true,
    });
    expect(normalizeInspectorLayout({ widthPx: 500 })).toEqual({
      widthPx: 500,
      collapsed: false,
    });
  });

  it("returns the default for anything missing or out of shape", () => {
    for (const raw of [null, undefined, 42, "wide", {}]) {
      expect(normalizeInspectorLayout(raw)).toEqual(DEFAULT_INSPECTOR_LAYOUT);
    }
  });
});
