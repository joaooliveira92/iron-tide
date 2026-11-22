import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { decodeBaseGrowthRules } from "@bluewave/content-schema";
import {
  GROWTH_BAND_MAX_BP,
  GROWTH_BAND_MIN_BP,
  MAX_ECONOMIC_BASE,
  stepBaseGrowth,
  type BaseGrowthRules,
} from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "12-13" }],
};

const sectionAt = (annualGrowthBp: number) => ({
  sectionVersion: 1,
  nations: { GBR: { annualGrowthBp, provenance } },
});

const rules: BaseGrowthRules = { nations: { GBR: { annualGrowthBp: 400 } } };

describe("stepBaseGrowth (S-3 D7)", () => {
  it("grows a listed nation by floor(base x rate / 120000)", () => {
    expect(stepBaseGrowth(rules, "GBR", SafeInt(60_000))).toEqual({
      base: 60_200,
      ceilingReached: false,
    });
  });

  it("leaves an unlisted nation, an absent section and a base too small to grow unchanged", () => {
    expect(stepBaseGrowth(rules, "FRA", SafeInt(60_000))).toBeUndefined();
    expect(stepBaseGrowth(undefined, "GBR", SafeInt(60_000))).toBeUndefined();
    expect(stepBaseGrowth(rules, "GBR", SafeInt(299))).toBeUndefined();
  });

  it("accepts exactly the rates the schema accepts: the schema band equals the growth band", () => {
    expect(decodeBaseGrowthRules(sectionAt(GROWTH_BAND_MIN_BP)).ok).toBe(true);
    expect(decodeBaseGrowthRules(sectionAt(GROWTH_BAND_MIN_BP - 1)).ok).toBe(false);
    expect(decodeBaseGrowthRules(sectionAt(GROWTH_BAND_MAX_BP)).ok).toBe(true);
    expect(decodeBaseGrowthRules(sectionAt(GROWTH_BAND_MAX_BP + 1)).ok).toBe(false);
  });

  it("clamps at the economic ceiling and reports it only on the month it is reached", () => {
    const ceiling = SafeInt(MAX_ECONOMIC_BASE);
    expect(stepBaseGrowth(rules, "GBR", SafeInt(MAX_ECONOMIC_BASE - 1))).toEqual({
      base: ceiling,
      ceilingReached: true,
    });
    expect(stepBaseGrowth(rules, "GBR", ceiling)).toBeUndefined();
  });
});
