import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  colonyDecayFactorBp,
  colonyIncomeForNation,
  type ColonyIncomeRules,
  type PossessionData,
} from "../src/index.js";

const rules: ColonyIncomeRules = {
  baselineYear: 1880,
  startFactorBp: 10_000,
  slopeBpPerYear: 120,
  floorBp: 2_500,
};

const possession = (id: string, nationId: string, colonyValueBp?: number): PossessionData => ({
  id,
  nationId,
  areaId: `area_${id}`,
  ...(colonyValueBp === undefined ? {} : { colonyValueBp: SafeInt(colonyValueBp) }),
});

describe("colonyDecayFactorBp (manual p.13)", () => {
  it("starts at the start factor in the baseline year", () => {
    expect(colonyDecayFactorBp(rules, "1880-01")).toBe(10_000);
  });

  it("falls by the slope per elapsed year, month by month", () => {
    expect(colonyDecayFactorBp(rules, "1881-01")).toBe(9_880);
    expect(colonyDecayFactorBp(rules, "1880-07")).toBe(10_000 - 60);
    expect(colonyDecayFactorBp(rules, "1900-01")).toBe(10_000 - 2_400);
  });

  it("holds at the floor and never goes below it", () => {
    expect(colonyDecayFactorBp(rules, "1970-12")).toBe(2_500);
    expect(colonyDecayFactorBp(rules, "2100-01")).toBe(2_500);
  });

  it("does not exceed the start factor before the baseline year", () => {
    expect(colonyDecayFactorBp(rules, "1850-06")).toBe(10_000);
  });

  it("is monotone non-increasing over the campaign", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let year = 1880; year <= 1970; year++)
      for (let month = 1; month <= 12; month++) {
        const factor = colonyDecayFactorBp(rules, `${year}-${String(month).padStart(2, "0")}`);
        expect(factor).toBeLessThanOrEqual(previous);
        previous = factor;
      }
  });
});

describe("colonyIncomeForNation", () => {
  const base = SafeInt(120_000);

  it("adds nothing without a ruleset section", () => {
    expect(
      colonyIncomeForNation(undefined, [possession("a", "GBR", 100)], "GBR", base, "1880-01"),
    ).toBeUndefined();
  });

  it("adds nothing when no owned possession carries a value", () => {
    expect(
      colonyIncomeForNation(
        rules,
        [possession("a", "GBR"), possession("b", "FRA", 100)],
        "GBR",
        base,
        "1880-01",
      ),
    ).toBeUndefined();
  });

  it("is the owned values as annual basis points of the base, per month, scaled by the factor", () => {
    const owned = [possession("a", "GBR", 100), possession("b", "GBR", 50)];
    expect(colonyIncomeForNation(rules, owned, "GBR", base, "1880-01")).toEqual({
      amount: 150,
      valueBp: 150,
      factorBp: 10_000,
    });
    expect(colonyIncomeForNation(rules, owned, "GBR", base, "1900-01")).toEqual({
      amount: 114,
      valueBp: 150,
      factorBp: 7_600,
    });
  });

  it("ignores possessions of other nations", () => {
    const owned = [possession("a", "GBR", 100), possession("b", "FRA", 900)];
    expect(colonyIncomeForNation(rules, owned, "GBR", base, "1880-01")?.valueBp).toBe(100);
  });

  it("adds nothing when the floored income is zero", () => {
    expect(
      colonyIncomeForNation(rules, [possession("a", "GBR", 1)], "GBR", SafeInt(1_000), "1880-01"),
    ).toBeUndefined();
  });
});
