import { describe, expect, it } from "vite-plus/test";
import { steerClearOfLand } from "@bluewave/combat/collision";
import type { TerrainView } from "@bluewave/combat/terrain";

const M = 1_000_000;

const terrain: TerrainView = {
  land: [
    {
      id: "wall",
      vertices: [
        { xM: 600, yM: -2000 },
        { xM: 700, yM: -2000 },
        { xM: 700, yM: 2000 },
        { xM: 600, yM: 2000 },
      ],
    },
  ],
  shallows: [],
  exclusions: [],
};

describe("AI land look-ahead", () => {
  it("keeps the heading when the next 60 seconds are clear", () => {
    expect(steerClearOfLand({ terrain, position: [0, 0], heading: 180, speedBp: 20_000 })).toBe(
      180,
    );
  });

  it("keeps the heading for a stationary ship", () => {
    expect(steerClearOfLand({ terrain, position: [0, 0], heading: 0, speedBp: 0 })).toBe(0);
  });

  it("turns away by the smallest angle that clears the land, increasing heading first", () => {
    const turned = steerClearOfLand({
      terrain,
      position: [0, 0],
      heading: 0,
      speedBp: 20_000,
    });
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThan(90);
    const smaller = steerClearOfLand({
      terrain,
      position: [0, 0],
      heading: turned - 1,
      speedBp: 20_000,
    });
    expect(smaller).toBe(turned);
  });

  it("is deterministic for a ship hugging the wall", () => {
    const input = {
      terrain,
      position: [595 * M, 0] as [number, number],
      heading: 0,
      speedBp: 1_000,
    };
    expect(steerClearOfLand(input)).toBe(steerClearOfLand(input));
  });
});
