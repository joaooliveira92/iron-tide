import { describe, expect, it } from "vite-plus/test";
import {
  placeBattleTerrain,
  pointInLand,
  pointInNoGoZone,
  type BattleTerrainRecord,
  type Position,
} from "@bluewave/combat/terrain";

const M = 1_000_000;

const record: BattleTerrainRecord = {
  areaId: "a_coast",
  battleOrigin: { xM: -2000, yM: -3000 },
  land: [
    {
      id: "isle",
      vertices: [
        { xM: 0, yM: 0 },
        { xM: 1000, yM: 0 },
        { xM: 1000, yM: 1000 },
        { xM: 0, yM: 1000 },
      ],
    },
  ],
  shallows: [
    {
      id: "shoal",
      vertices: [
        { xM: 1000, yM: 0 },
        { xM: 1500, yM: 0 },
        { xM: 1500, yM: 500 },
      ],
    },
  ],
  exclusions: [{ id: "exclusion.p", portId: "p", xM: 1500, yM: 1500, radiusM: 400 }],
};

const at = (xM: number, yM: number): Position => [xM * M, yM * M];

describe("placeBattleTerrain", () => {
  it("translates the area frame so the battle origin lands on the battle corner", () => {
    const view = placeBattleTerrain(record);
    expect(view.land[0]?.vertices[0]).toEqual({ xM: 2000, yM: 3000 });
    expect(view.shallows[0]?.vertices[2]).toEqual({ xM: 3500, yM: 3500 });
    expect(view.exclusions).toEqual([{ id: "exclusion.p", xM: 3500, yM: 4500, radiusM: 400 }]);
  });

  it("answers terrain queries in battle coordinates", () => {
    const view = placeBattleTerrain(record);
    expect(pointInLand(view, at(2500, 3500))).toBe(true);
    expect(pointInLand(view, at(500, 500))).toBe(false);
    expect(pointInNoGoZone(view, at(3500, 4500))).toBe(true);
  });

  it("is a pure integer translation", () => {
    const view = placeBattleTerrain(record);
    const again = placeBattleTerrain(record);
    expect(again).toEqual(view);
    for (const polygon of [...view.land, ...view.shallows]) {
      for (const vertex of polygon.vertices) {
        expect(Number.isSafeInteger(vertex.xM)).toBe(true);
        expect(Number.isSafeInteger(vertex.yM)).toBe(true);
      }
    }
  });
});
