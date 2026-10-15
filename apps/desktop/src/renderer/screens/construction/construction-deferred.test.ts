import { describe, expect, it } from "vite-plus/test";
import { DEFERRED_CONSTRUCTION_ITEMS } from "./construction-screen-state.js";

describe("DEFERRED_CONSTRUCTION_ITEMS", () => {
  it("lists build sub, forts/bases and coastal fortifications with reasons", () => {
    expect(DEFERRED_CONSTRUCTION_ITEMS.map((i) => i.id)).toEqual([
      "build-submarine",
      "build-fort-base",
      "coastal-fortifications",
    ]);
    expect(DEFERRED_CONSTRUCTION_ITEMS.every((i) => i.reason.length > 20)).toBe(true);
  });
});
