import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { baseGrowthFromRulesets } from "../src/index.js";
import { validateBaseGrowthRules } from "../src/stages/validateBaseGrowthRules.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "12-13" }],
};

const ruleset = (id: string, annualGrowthBp: number, nationId = "GBR") => ({
  id,
  baseGrowth: { sectionVersion: 1, nations: { [nationId]: { annualGrowthBp, provenance } } },
});

const codes = (rulesets: readonly unknown[]) => {
  const collector = new DiagnosticCollector();
  validateBaseGrowthRules(rulesets, [{ id: "GBR" }], collector);
  return collector.all.map((d) => d.code);
};

describe("baseGrowth ruleset section (S-3 D7)", () => {
  it("is absent for a ruleset without the section and decoded for one with it", () => {
    expect(baseGrowthFromRulesets([{ id: "production" }])).toBeUndefined();
    const decoded = baseGrowthFromRulesets([ruleset("fixture", 400)]);
    expect(decoded?.ok && decoded.value.nations["GBR"]?.annualGrowthBp).toBe(400);
  });

  it("accepts no section and a valid section without diagnostics", () => {
    expect(codes([{ id: "production" }])).toEqual([]);
    expect(codes([ruleset("fixture", 400)])).toEqual([]);
  });

  it("reports an out-of-band rate, an unknown nation and two carriers", () => {
    expect(codes([ruleset("fixture", 600)])).toEqual(["BASE_GROWTH_RULES_INVALID"]);
    expect(codes([ruleset("fixture", 400, "XXX")])).toEqual(["BASE_GROWTH_NATION_UNKNOWN"]);
    expect(codes([ruleset("a", 400), ruleset("b", 400)])).toContain("BASE_GROWTH_RULES_AMBIGUOUS");
  });
});
