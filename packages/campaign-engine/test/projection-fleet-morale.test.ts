import { describe, expect, it } from "vite-plus/test";
import { buildPlayerProjection } from "../src/projection.js";
import { fixtureNation, fixtureSnapshot, fixtureState } from "./fixtures.js";

const MONTH = { month: 3, year: 1880 } as const;

function projectionWith(nation: Partial<Parameters<typeof fixtureNation>[0]> = {}) {
  const state = fixtureState(fixtureSnapshot([fixtureNation({ id: "uk", ...nation })]));
  return buildPlayerProjection(state, "uk", MONTH)!;
}

describe("player projection: unrest change", () => {
  it("carries no change before the first unrest movement", () => {
    expect(projectionWith().unrestChange).toBeUndefined();
  });

  it("exposes the last change with its explanation tree", () => {
    const { unrestChange } = projectionWith({
      unrest: 5,
      unrestLastChange: {
        before: 3,
        after: 5,
        contributions: [
          { reasonCode: "MILITARY_SPENDING", delta: 3 },
          { reasonCode: "VICTORY", delta: -1 },
        ],
        month: "1880-02",
      },
    });
    expect(unrestChange).toMatchObject({
      before: 3,
      after: 5,
      delta: 2,
      month: "1880-02",
      reasonCodes: ["MILITARY_SPENDING", "VICTORY"],
    });
    expect(unrestChange?.changeExplanation.formulaId).toBe("unrest_change");
    expect(Number(unrestChange?.changeExplanation.result)).toBe(5);
  });
});

describe("player projection: fleet morale", () => {
  it("reads absent morale as full on the 0 to 100 scale, with no last change", () => {
    const { fleetMorale } = projectionWith();
    expect(fleetMorale.current).toBe(100);
    expect(fleetMorale.max).toBe(100);
    expect(fleetMorale.lastChange).toBeUndefined();
    expect(fleetMorale.changeExplanation).toBeUndefined();
  });

  it("exposes the stored morale, the last change and its explanation tree", () => {
    const { fleetMorale } = projectionWith({
      fleetMorale: 90,
      fleetMoraleLastChange: {
        before: 100,
        after: 90,
        unclampedAfter: 90,
        contributions: [{ reasonCode: "UNPAID_FUNDS", delta: -10 }],
        month: "1880-02",
      },
    });
    expect(fleetMorale.current).toBe(90);
    expect(fleetMorale.lastChange).toEqual({
      before: 100,
      after: 90,
      delta: -10,
      month: "1880-02",
      reasonCodes: ["UNPAID_FUNDS"],
    });
    expect(fleetMorale.changeExplanation?.formulaId).toBe("fleet_morale_change");
    expect(Number(fleetMorale.changeExplanation?.result)).toBe(90);
  });
});
