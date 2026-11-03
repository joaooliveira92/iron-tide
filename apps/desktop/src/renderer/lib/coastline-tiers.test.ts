import { describe, expect, it } from "vite-plus/test";
import { COASTLINE_TIER_TOLERANCES, coastlineTierFor } from "./coastline-tiers.js";

describe("coastlineTierFor", () => {
  it("uses the coarse tier when zoomed out, full detail when zoomed in", () => {
    expect(coastlineTierFor(0.9)).toBe(0);
    expect(coastlineTierFor(2.99)).toBe(0);
    expect(coastlineTierFor(3)).toBe(1);
    expect(coastlineTierFor(7.99)).toBe(1);
    expect(coastlineTierFor(8)).toBe(2);
    expect(coastlineTierFor(60)).toBe(2);
  });

  it("has one tolerance per tier, finest last (0 = unsimplified)", () => {
    expect(COASTLINE_TIER_TOLERANCES).toEqual([0.1, 0.02, 0]);
  });
});
