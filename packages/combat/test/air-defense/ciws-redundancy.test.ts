import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  CIWS_DIMINISHING_RETURNS_ACTIVE,
  CIWS_STRONG_REDUNDANCY_ACTIVE,
  ciwsMarginalMultiplierBp,
  ciwsSaturationMarkers,
  computeCiwsSaturationFactorBp,
  INVALID_AIR_DEFENSE_STATE,
  isCiwsContributingSystem,
} from "../../src/air-defense/index.js";

describe("AC-10: §15 CIWS contribution predicate", () => {
  it("a fully healthy CIWS system contributes to the redundant set", () => {
    expect(
      isCiwsContributingSystem({
        damaged: false,
        unpowered: false,
        empty: false,
        jammed: false,
        outOfArc: false,
      }),
    ).toBe(true);
  });

  it("each §15 zero-contribution condition independently excludes the system", () => {
    const healthy = {
      damaged: false,
      unpowered: false,
      empty: false,
      jammed: false,
      outOfArc: false,
    };
    expect(isCiwsContributingSystem({ ...healthy, damaged: true })).toBe(false);
    expect(isCiwsContributingSystem({ ...healthy, unpowered: true })).toBe(false);
    expect(isCiwsContributingSystem({ ...healthy, empty: true })).toBe(false);
    expect(isCiwsContributingSystem({ ...healthy, jammed: true })).toBe(false);
    expect(isCiwsContributingSystem({ ...healthy, outOfArc: true })).toBe(false);
  });
});

describe("AC-10: §16 CIWS redundancy factor schedule", () => {
  it("matches the canonical §16 marginal sums exactly: systems 1..9", () => {
    const expected = [10_000, 20_000, 30_000, 40_000, 45_000, 50_000, 51_500, 53_000, 53_500];
    expected.forEach((value, index) => {
      const count = index + 1;
      expect(computeCiwsSaturationFactorBp(count)).toBe(value);
      expect(Number(computeCiwsSaturationFactorBp(count)) / 10_000).toBe(value / 10_000);
    });
  });

  it("is NOT a construction cap: 12 and 15 systems are legal and each system above the eighth adds the residual 500", () => {
    expect(computeCiwsSaturationFactorBp(12)).toBe(55_000);
    expect(computeCiwsSaturationFactorBp(15)).toBe(56_500);
    expect(
      Number(computeCiwsSaturationFactorBp(12)) - Number(computeCiwsSaturationFactorBp(8)),
    ).toBe(4 * 500);
    for (let count = 10; count <= 24; count++) {
      let manual = 0;
      for (let n = 1; n <= count; n++) {
        manual += ciwsMarginalMultiplierBp(n);
      }
      expect(computeCiwsSaturationFactorBp(count)).toBe(manual);
    }
  });

  it("embeds the exact §16 rational in the numerator — the owning formula divides by 10_000 once", () => {
    expect(computeCiwsSaturationFactorBp(4) / 10_000).toBe(4.0);
    expect(computeCiwsSaturationFactorBp(7) / 10_000).toBe(5.15);
    expect(computeCiwsSaturationFactorBp(15) / 10_000).toBe(5.65);
  });

  it("returns the NEUTRAL consumer-side factor 10_000 for a ship with no contributing CIWS system", () => {
    expect(computeCiwsSaturationFactorBp(0)).toBe(10_000);
  });

  it("emits §28 markers only in the documented regimes: 5..6 diminishing, 7+ strong redundancy", () => {
    expect(ciwsSaturationMarkers(0)).toEqual([]);
    expect(ciwsSaturationMarkers(4)).toEqual([]);
    expect(ciwsSaturationMarkers(5)).toEqual([CIWS_DIMINISHING_RETURNS_ACTIVE]);
    expect(ciwsSaturationMarkers(6)).toEqual([CIWS_DIMINISHING_RETURNS_ACTIVE]);
    expect(ciwsSaturationMarkers(7)).toEqual([CIWS_STRONG_REDUNDANCY_ACTIVE]);
    expect(ciwsSaturationMarkers(12)).toEqual([CIWS_STRONG_REDUNDANCY_ACTIVE]);
  });

  it("fails closed on a negative or non-integer system count with INVALID_AIR_DEFENSE_STATE", () => {
    let caught: unknown;
    try {
      computeCiwsSaturationFactorBp(-1);
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).context.code).toBe(INVALID_AIR_DEFENSE_STATE);

    expect(() => computeCiwsSaturationFactorBp(1.5)).toThrow(BluewaveError);
    expect(() => computeCiwsSaturationFactorBp(Number.NaN)).toThrow(BluewaveError);
    expect(() => ciwsSaturationMarkers(-2)).toThrow(BluewaveError);
    expect(() => ciwsSaturationMarkers(7.5)).toThrow(BluewaveError);
  });
});
