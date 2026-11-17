import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { nextHopToward, seaAdjacency, seaRoute, type WorldState } from "../src/index.js";

const distance = SafeInt.ONE;

function world(): Pick<WorldState, "areas" | "routes"> {
  return {
    areas: [
      { id: "a", name: "a", type: "sea" },
      { id: "b", name: "b", type: "sea" },
      { id: "c", name: "c", type: "sea" },
      { id: "d", name: "d", type: "sea" },
      { id: "e", name: "e", type: "sea" },
      { id: "iso", name: "iso", type: "sea" },
      { id: "shore", name: "shore", type: "land" },
    ],
    routes: [
      { id: "r1", from: "a", to: "c", type: "sea", distance },
      { id: "r2", from: "a", to: "b", type: "sea", distance },
      { id: "r3", from: "c", to: "d", type: "sea", distance },
      { id: "r4", from: "b", to: "d", type: "sea", distance },
      { id: "r5", from: "d", to: "e", type: "sea", distance },
      { id: "r6", from: "a", to: "shore", type: "sea", distance },
      { id: "r7", from: "e", to: "iso", type: "land", distance },
    ],
  };
}

describe("seaRoute", () => {
  it("breaks hop-count ties by the lowest area id", () => {
    expect(seaRoute(world(), "a", "d")).toEqual(["b", "d"]);
    expect(seaRoute(world(), "d", "a")).toEqual(["b", "a"]);
  });

  it("returns the full path to a distant area, one entry per month", () => {
    expect(seaRoute(world(), "a", "e")).toEqual(["b", "d", "e"]);
  });

  it("is empty for the same area and null when no sea path exists", () => {
    expect(seaRoute(world(), "a", "a")).toEqual([]);
    expect(seaRoute(world(), "a", "iso")).toBeNull();
    expect(seaRoute(world(), "a", "shore")).toBeNull();
    expect(seaRoute(world(), "a", "nowhere")).toBeNull();
  });

  it("agrees with nextHopToward on the first hop", () => {
    const adjacency = seaAdjacency(world());
    expect(nextHopToward("a", "e", adjacency)).toBe("b");
    expect(nextHopToward("a", "a", adjacency)).toBeNull();
  });
});
