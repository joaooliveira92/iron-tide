import { describe, expect, it } from "vite-plus/test";
import { topsideLoad, topsideStatus, type ArrangementResult } from "../src/index.js";

const arr = (zones: [number, number][]): ArrangementResult =>
  ({
    zones: zones.map(([u, c], i) => ({
      zoneId: (["FORECASTLE", "SUPERSTRUCTURE", "QUARTERDECK"] as const)[i % 3],
      weightKg: 0,
      volumeUsedLitre: 0,
      volumeCapacityLitre: 0,
      deckUsedMm2: u,
      deckCapacityMm2: c,
    })),
    totalWeightKg: 0,
    lcgPermille: null,
    verticalMomentKgMm: 0,
    findings: [],
  }) as ArrangementResult;

describe("topsideLoad", () => {
  it("no arrangement or no fittings is an empty normal load", () => {
    expect(topsideLoad(null)).toMatchObject({
      usedMm2: 0,
      capacityMm2: 0,
      status: "normal",
      utilizationBp: null,
    });
    expect(topsideLoad(arr([[0, 1000]]))).toMatchObject({
      usedMm2: 0,
      utilizationBp: 0,
      status: "normal",
    });
  });
  it("zero capacity: normal when empty, exceeded when anything is placed", () => {
    expect(topsideStatus(0, 0)).toBe("normal");
    expect(topsideStatus(1, 0)).toBe("exceeded");
    expect(topsideLoad(arr([[5, 0]]))).toMatchObject({ status: "exceeded", utilizationBp: null });
  });
  it("bands: below 80 % normal, 80-100 % warning (100 % exactly is not exceeded), above exceeded", () => {
    expect(topsideStatus(7_999, 10_000)).toBe("normal");
    expect(topsideStatus(8_000, 10_000)).toBe("warning");
    expect(topsideStatus(10_000, 10_000)).toBe("warning");
    expect(topsideStatus(10_001, 10_000)).toBe("exceeded");
  });
  it("reports absolute and remaining values, with fractional percentages kept in bp", () => {
    const t = topsideLoad(arr([[1, 3]]));
    expect(t).toMatchObject({ usedMm2: 1, capacityMm2: 3, remainingMm2: 2, utilizationBp: 3333 });
  });
  it("over-capacity gives negative remaining", () => {
    expect(topsideLoad(arr([[12, 10]]))).toMatchObject({
      remainingMm2: -2,
      utilizationBp: 12000,
      status: "exceeded",
    });
  });
  it("one over-full zone makes the ship exceeded even with spare area elsewhere", () => {
    const t = topsideLoad(
      arr([
        [20, 10],
        [0, 100],
      ]),
    );
    expect(t.status).toBe("exceeded");
    expect(t.usedMm2).toBe(20);
    expect(t.zones.map((z) => z.status)).toEqual(["exceeded", "normal"]);
  });
  it("is deterministic and handles huge areas without precision loss", () => {
    const big = arr([[9_007_199_254_740_000, 9_007_199_254_740_991]]);
    expect(topsideLoad(big)).toEqual(topsideLoad(big));
    expect(topsideLoad(big).utilizationBp).toBe(9999);
  });
});
