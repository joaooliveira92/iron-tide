import { describe, expect, it } from "vite-plus/test";
import {
  antiAircraftBalanceProblem,
  antiAircraftFindings,
  antiAircraftFitProblem,
  antiAircraftResult,
  expandAntiAircraft,
  MAX_AA_DIRECTORS,
  type AntiAircraftBalance,
} from "../src/index.js";

// Fixture values, not game values: the tests assert the arithmetic, not any gameplay number.
const balance: AntiAircraftBalance = {
  fromMonth: "1915-01",
  lightGunWeightKg: 100,
  mediumGunWeightKg: 1_000,
  directorWeightKg: 500,
  lightGunFootprintMm2: 10,
  mediumGunFootprintMm2: 100,
  directorFootprintMm2: 1_000,
};
const fit = { lightGuns: 4, mediumGuns: 2, directors: 3 };

describe("expandAntiAircraft", () => {
  it("is nothing without a fit, without a balance section, or before the option's date", () => {
    const none = { weightKg: 0, footprintMm2: 0 };
    expect(expandAntiAircraft(undefined, balance, "1930-01")).toEqual(none);
    expect(expandAntiAircraft(fit, undefined, "1930-01")).toEqual(none);
    expect(expandAntiAircraft(fit, balance, "1914-12")).toEqual(none);
  });
  it("adds each gun, medium gun and director at its configured weight and deck area", () => {
    expect(expandAntiAircraft(fit, balance, "1915-01")).toEqual({
      weightKg: 4 * 100 + 2 * 1_000 + 3 * 500,
      footprintMm2: 4 * 10 + 2 * 100 + 3 * 1_000,
    });
  });
  it("scales linearly with each count", () => {
    const one = expandAntiAircraft(
      { lightGuns: 1, mediumGuns: 0, directors: 0 },
      balance,
      "1930-01",
    );
    const five = expandAntiAircraft(
      { lightGuns: 5, mediumGuns: 0, directors: 0 },
      balance,
      "1930-01",
    );
    expect(five.weightKg).toBe(one.weightKg * 5);
  });
  it("refuses a malformed fit", () => {
    expect(() =>
      expandAntiAircraft({ lightGuns: -1, mediumGuns: 0, directors: 0 }, balance, "1930-01"),
    ).toThrow(/antiAircraft/);
  });
});

describe("antiAircraftFitProblem", () => {
  it("caps directors at the manual's four and refuses non-integers", () => {
    expect(antiAircraftFitProblem(fit)).toBeNull();
    expect(antiAircraftFitProblem({ ...fit, directors: MAX_AA_DIRECTORS + 1 })).toMatch(
      /at most 4/,
    );
    expect(antiAircraftFitProblem({ ...fit, lightGuns: 1.5 })).toMatch(/integers/);
    expect(antiAircraftFitProblem({ ...fit, mediumGuns: 1_001 })).toMatch(/integers/);
    expect(antiAircraftFitProblem(null)).toMatch(/antiAircraft/);
    expect(MAX_AA_DIRECTORS).toBe(4);
  });
});

describe("antiAircraftResult and findings", () => {
  it("is null for no request, even a zero one", () => {
    expect(antiAircraftResult(undefined, balance, "1930-01")).toBeNull();
    expect(
      antiAircraftResult({ lightGuns: 0, mediumGuns: 0, directors: 0 }, balance, "1930-01"),
    ).toBeNull();
    expect(antiAircraftFindings(null)).toEqual([]);
  });
  it("records availability and says what is, or is not, modelled", () => {
    const ok = antiAircraftResult(fit, balance, "1930-01")!;
    expect(ok.available).toBe(true);
    expect(antiAircraftFindings(ok)[0]!.id).toBe("ANTI_AIRCRAFT_NOT_MODELLED_IN_BATTLE");
    const early = antiAircraftResult(fit, balance, "1900-01")!;
    expect(early).toMatchObject({ available: false, weightKg: 0, footprintMm2: 0 });
    expect(antiAircraftFindings(early)[0]!.id).toBe("ANTI_AIRCRAFT_UNAVAILABLE");
  });
});

describe("antiAircraftBalanceProblem", () => {
  it("accepts a well-formed section and names what is wrong with a bad one", () => {
    expect(antiAircraftBalanceProblem(balance)).toBeNull();
    // Weights and areas are not counts: they are not held to the count bound.
    expect(
      antiAircraftBalanceProblem({
        ...balance,
        mediumGunWeightKg: 2_500,
        mediumGunFootprintMm2: 10_000_000,
      }),
    ).toBeNull();
    expect(antiAircraftBalanceProblem(null)).toMatch(/object/);
    expect(antiAircraftBalanceProblem({ ...balance, fromMonth: "soon" })).toMatch(/fromMonth/);
    expect(antiAircraftBalanceProblem({ ...balance, directorWeightKg: -1 })).toMatch(
      /directorWeightKg/,
    );
    const { lightGunWeightKg: _gone, ...partial } = balance;
    expect(antiAircraftBalanceProblem(partial)).toMatch(/lightGunWeightKg/);
  });
});
