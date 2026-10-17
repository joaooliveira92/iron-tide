/* @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vite-plus/test";

import { applyReducedMotion, applyTextScale, resolveReducedMotion } from "./display-preferences.js";

afterEach(() => {
  document.documentElement.style.fontSize = "";
  delete document.documentElement.dataset["reducedMotion"];
});

describe("display preferences (U-4 ticket 04)", () => {
  it("resolves reduced motion, with `system` deferring to the media query", () => {
    expect(resolveReducedMotion("reduce", false)).toBe(true);
    expect(resolveReducedMotion("noPreference", true)).toBe(false);
    expect(resolveReducedMotion("system", true)).toBe(true);
    expect(resolveReducedMotion("system", false)).toBe(false);
  });

  it("applies text scale as a root font size", () => {
    applyTextScale(110);
    expect(document.documentElement.style.fontSize).toBe("110%");
  });

  it("applies reduced motion as a root data attribute", () => {
    applyReducedMotion(true);
    expect(document.documentElement.dataset["reducedMotion"]).toBe("reduce");
    applyReducedMotion(false);
    expect(document.documentElement.dataset["reducedMotion"]).toBe("no-preference");
  });
});
