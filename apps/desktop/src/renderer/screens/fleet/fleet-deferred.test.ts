import { describe, expect, it } from "vite-plus/test";
import { DEFERRED_SUBMARINE_ITEMS } from "./fleet-screen-state.js";

describe("DEFERRED_SUBMARINE_ITEMS", () => {
  it("records why submarines are not shown, with unique ids", () => {
    expect(DEFERRED_SUBMARINE_ITEMS.map((i) => i.id)).toEqual([
      "submarine-roster",
      "submarine-auto-build",
    ]);
    expect(DEFERRED_SUBMARINE_ITEMS.every((i) => i.reason.length > 20)).toBe(true);
    expect(DEFERRED_SUBMARINE_ITEMS[0]?.reason).toMatch(/1880/);
  });
});
