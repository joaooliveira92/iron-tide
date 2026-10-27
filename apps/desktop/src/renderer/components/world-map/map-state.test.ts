import { describe, expect, it } from "vite-plus/test";
import { initialMapPrototypeState, readRoute } from "./map-state.js";

describe("initialMapPrototypeState", () => {
  it("opens with no measured route, so the campaign map has no stray ruler line", () => {
    expect(initialMapPrototypeState.rulerFrom).toBeNull();
    expect(initialMapPrototypeState.rulerTo).toBeNull();
    expect(readRoute(initialMapPrototypeState, [])).toBeNull();
  });
});

describe("readRoute", () => {
  it("reads hops from the campaign's own sea lanes", () => {
    const state = {
      ...initialMapPrototypeState,
      rulerFrom: "area_north_sea",
      rulerTo: "area_western_approaches",
    };
    const route = readRoute(state, [
      { a: "area_north_sea", b: "area_western_approaches" },
      { a: "area_western_approaches", b: "area_central_atlantic" },
    ]);
    expect(route?.path).toEqual(["area_north_sea", "area_western_approaches"]);
    expect(route?.hops).toBe(1);
  });

  it("has no reading between areas the campaign does not join", () => {
    const state = {
      ...initialMapPrototypeState,
      rulerFrom: "area_north_sea",
      rulerTo: "area_central_atlantic",
    };
    expect(readRoute(state, [{ a: "area_north_sea", b: "area_western_approaches" }])).toBeNull();
  });
});
