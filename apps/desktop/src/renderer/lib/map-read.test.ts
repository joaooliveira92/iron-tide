import { describe, expect, it } from "vite-plus/test";

import { inspectMapFixture } from "./inspect-map-fixture.js";
import { MAP_SHAPE_REJECTED_MESSAGE, confirmMapRead } from "./map-read.js";

describe("confirmMapRead", () => {
  it("passes a result that satisfies the inspectMap contract through unchanged", () => {
    const read = { status: "ready" as const, value: inspectMapFixture() };
    expect(confirmMapRead(read)).toEqual(read);
  });

  it("passes an unavailable read through unchanged", () => {
    const read = { status: "unavailable" as const, reason: "NOPE" };
    expect(confirmMapRead(read)).toBe(read);
  });

  it.each([
    ["an empty object", {}],
    ["a result without strategic", { revision: 1, playerNationId: "uk" }],
    ["a strategic view without world", { ...inspectMapFixture(), strategic: {} }],
    [
      "a world without areas",
      {
        ...inspectMapFixture(),
        strategic: {
          ...inspectMapFixture().strategic,
          world: { ports: [], fleets: [], routes: [] },
        },
      },
    ],
    [
      "a strategic view without playerFleets",
      { ...inspectMapFixture(), strategic: { world: inspectMapFixture().strategic.world } },
    ],
  ])("reports %s as unavailable instead of folding it into an empty map", (_name, value) => {
    expect(confirmMapRead({ status: "ready", value })).toEqual({
      status: "unavailable",
      reason: MAP_SHAPE_REJECTED_MESSAGE,
    });
  });
});
