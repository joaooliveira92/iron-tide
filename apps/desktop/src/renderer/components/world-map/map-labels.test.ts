import { describe, expect, it } from "vite-plus/test";
import { labelPresentation } from "./map-labels.js";

describe("labelPresentation", () => {
  it("shows only the big names when zoomed out", () => {
    expect(labelPresentation("country", 1)).not.toBeNull();
    expect(labelPresentation("continent", 1)).not.toBeNull();
    expect(labelPresentation("sea", 1, { big: true })).not.toBeNull();
    expect(labelPresentation("sea", 1, { big: false })).toBeNull();
    expect(labelPresentation("port", 1, { major: true })).toBeNull();
  });

  it("reveals ports as you zoom in, major before minor", () => {
    expect(labelPresentation("port", 3.7, { major: true })).not.toBeNull();
    expect(labelPresentation("port", 3.7, { major: false })).toBeNull();
    expect(labelPresentation("port", 3.1, { major: true })).toBeNull();
    expect(labelPresentation("port", 7, { major: false })).not.toBeNull();
  });

  it("retires the larger names as smaller ones arrive", () => {
    expect(labelPresentation("continent", 3)).toBeNull();
    expect(labelPresentation("country", 55)).toBeNull();
    expect(labelPresentation("country", 10)).not.toBeNull();
    expect(labelPresentation("sea", 20, { big: true })).toBeNull();
    expect(labelPresentation("sea", 20, { big: false })).not.toBeNull();
  });

  it("shrinks and fades names on the way out", () => {
    const wide = labelPresentation("country", 2);
    const close = labelPresentation("country", 35);
    expect(close!.px).toBeLessThan(wide!.px);
    expect(close!.opacity).toBeLessThan(wide!.opacity);
    const basinFar = labelPresentation("sea", 1, { big: true });
    const basinNear = labelPresentation("sea", 8, { big: true });
    expect(basinNear!.px).toBeLessThan(basinFar!.px);
  });
});
