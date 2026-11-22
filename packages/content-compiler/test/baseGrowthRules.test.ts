import { createRequire } from "node:module";
import { resolve } from "node:path";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { baseGrowthFromRulesets, ValidateStage } from "../src/index.js";
import type { ParseOutput } from "../src/stages/parse.js";
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

describe("baseGrowth through the validate stage", () => {
  const stageCodes = (rulesets: unknown[], countries: unknown[]) => {
    const input: ParseOutput = {
      manifest: { name: "test-pack", version: "0.1.0", type: "fixture", files: {} },
      collectionDocs: new Map<string, unknown[]>([
        ["rulesets", rulesets],
        ["countries", countries],
      ]),
      sourcePaths: new Map(),
      objectDocs: new Map(),
      objectSourcePaths: new Map(),
      contentDir: ".",
    };
    const collector = new DiagnosticCollector();
    new ValidateStage().run(input, new AbortController().signal, collector);
    return collector.all.map((d) => d.code as string);
  };
  const stageRuleset = (nationId: string) => ({
    ...ruleset("fixture", 400, nationId),
    name: "fixture",
    version: "1.0",
  });

  const countries = () =>
    structuredClone(
      (
        createRequire(import.meta.url)(
          resolve(import.meta.dirname, "../../../content/production/1880/countries.ts"),
        ) as { readonly default: unknown[] }
      ).default,
    );

  it("resolves section nations against the pack's country ids", () => {
    expect(stageCodes([stageRuleset("uk")], countries())).not.toContain(
      "BASE_GROWTH_NATION_UNKNOWN",
    );
    expect(stageCodes([stageRuleset("XXX")], countries())).toContain("BASE_GROWTH_NATION_UNKNOWN");
  });
});
