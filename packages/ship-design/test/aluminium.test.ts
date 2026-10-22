import { describe, expect, it } from "vite-plus/test";
import { aluminiumAvailable, type AluminiumBalance } from "../src/index.js";
import { aluminiumBalanceProblem, aluminiumFindings, aluminiumFitting } from "../src/aluminium.js";

const balance: AluminiumBalance = { fromMonth: "1930-01", hullWeightSavingBp: 1_000 };

describe("aluminiumAvailable", () => {
  it("is never available without a balance section, and from the configured month with one", () => {
    expect(aluminiumAvailable(undefined, "1999-12")).toBe(false);
    expect(aluminiumAvailable(balance, "1929-12")).toBe(false);
    expect(aluminiumAvailable(balance, "1930-01")).toBe(true);
  });
});

describe("aluminiumFitting", () => {
  it("is nothing for a design that does not ask for it", () => {
    expect(aluminiumFitting({}, balance, "1935-01")).toBeNull();
    expect(aluminiumFitting({ aluminiumSuperstructure: false }, balance, "1935-01")).toBeNull();
  });
  it("carries the configured saving when available, and none when it is not", () => {
    const draft = { aluminiumSuperstructure: true };
    expect(aluminiumFitting(draft, balance, "1935-01")).toEqual({
      fitted: true,
      available: true,
      savingBp: 1_000,
    });
    expect(aluminiumFitting(draft, balance, "1900-01")).toEqual({
      fitted: true,
      available: false,
      savingBp: 0,
    });
    expect(aluminiumFitting(draft, undefined, "1935-01")?.available).toBe(false);
  });
});

describe("aluminiumFindings", () => {
  it("says nothing without a request, warns about fire risk when used, and explains when it did nothing", () => {
    expect(aluminiumFindings(null)).toEqual([]);
    expect(aluminiumFindings({ fitted: true, available: true, savingBp: 1_000 })[0]!.id).toBe(
      "ALUMINIUM_FIRE_SUSCEPTIBILITY",
    );
    expect(aluminiumFindings({ fitted: true, available: false, savingBp: 0 })[0]!.id).toBe(
      "ALUMINIUM_SUPERSTRUCTURE_UNAVAILABLE",
    );
  });
});

describe("aluminiumBalanceProblem", () => {
  it("accepts a well-formed section and names what is wrong with a bad one", () => {
    expect(aluminiumBalanceProblem(balance)).toBeNull();
    expect(aluminiumBalanceProblem(null)).toMatch(/object/);
    expect(aluminiumBalanceProblem({ ...balance, fromMonth: "1930" })).toMatch(/fromMonth/);
    expect(aluminiumBalanceProblem({ ...balance, hullWeightSavingBp: 10.5 })).toMatch(/hullWeight/);
    expect(aluminiumBalanceProblem({ ...balance, hullWeightSavingBp: 9_000 })).toMatch(
      /hullWeight/,
    );
  });
});
