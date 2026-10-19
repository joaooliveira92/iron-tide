import { describe, expect, it } from "vite-plus/test";
import { initialMapPrototypeState, readRoute } from "./map-state.js";

describe("initialMapPrototypeState", () => {
  it("opens with no measured route, so the campaign map has no stray ruler line", () => {
    expect(initialMapPrototypeState.rulerFrom).toBeNull();
    expect(initialMapPrototypeState.rulerTo).toBeNull();
    expect(readRoute(initialMapPrototypeState)).toBeNull();
  });
});
