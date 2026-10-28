import { describe, expect, it } from "vite-plus/test";

import { MAP_CONTAINER_STYLE, hasRenderableSize } from "./map-container.js";

describe("map container", () => {
  it("fills its positioned parent with explicit inline dimensions", () => {
    expect(MAP_CONTAINER_STYLE).toEqual({
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
    });
  });

  it("rejects zero, negative and non-finite sizes that would leave a blank canvas", () => {
    expect(hasRenderableSize(1470, 868)).toBe(true);
    expect(hasRenderableSize(1470, 0)).toBe(false);
    expect(hasRenderableSize(0, 868)).toBe(false);
    expect(hasRenderableSize(-1, 868)).toBe(false);
    expect(hasRenderableSize(Number.NaN, 868)).toBe(false);
  });
});
