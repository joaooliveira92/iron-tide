import { describe, expect, it } from "vite-plus/test";
import { visualLook, visualMountInputs } from "./visualMounts.js";
import { reference, view } from "./test-fixtures.js";

describe("visualMountInputs", () => {
  it("reads every placement's station and side from the draft and its gun identity from the compile", () => {
    const inputs = visualMountInputs(reference.draft, view);
    expect(inputs).toHaveLength(reference.draft.placements.length);
    expect(inputs.find((m) => m.instanceId === "gun_6pdr_a")).toEqual({
      instanceId: "gun_6pdr_a",
      stationPermille: 700,
      side: "PORT",
      category: "SECONDARY_GUN",
      mountType: "DECK_OPEN",
      gunCount: 1,
      caliberUm: 57_000,
    });
  });

  it("omits placements the compile did not resolve", () => {
    const empty = { ...view, compiled: { ...view.compiled, components: [] } };
    expect(visualMountInputs(reference.draft, empty)).toEqual([]);
  });
});

describe("visualLook", () => {
  it("is the designing nation's style in the design month's era", () => {
    expect(visualLook("uk", "1895-06")).toEqual({ style: "B", era: "VICTORIAN" });
    expect(visualLook("brazil", "1898-01")).toEqual({ style: "X", era: "PRE_DREADNOUGHT" });
  });

  it("draws a malformed month in the default dreadnought era", () => {
    expect(visualLook("uk", "1895")).toEqual({ style: "B", era: "DREADNOUGHT" });
  });
});
