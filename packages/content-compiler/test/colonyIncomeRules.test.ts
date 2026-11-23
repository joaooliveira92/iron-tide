import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { colonyIncomeFromRulesets, ValidateStage } from "../src/index.js";
import type { ParseOutput } from "../src/stages/parse.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "13" }],
};

const ruleset = (id: string, floorBp: number) => ({
  id,
  name: id,
  version: "1.0",
  colonyIncome: {
    sectionVersion: 1,
    baselineYear: 1880,
    startFactorBp: 10_000,
    slopeBpPerYear: 80,
    floorBp,
    provenance,
  },
});

const stageCodes = (rulesets: unknown[]) => {
  const input: ParseOutput = {
    manifest: { name: "test-pack", version: "0.1.0", type: "fixture", files: {} },
    collectionDocs: new Map<string, unknown[]>([["rulesets", rulesets]]),
    sourcePaths: new Map(),
    objectDocs: new Map(),
    objectSourcePaths: new Map(),
    contentDir: ".",
  };
  const collector = new DiagnosticCollector();
  new ValidateStage().run(input, new AbortController().signal, collector);
  return collector.all.map((d) => d.code as string);
};

describe("colonyIncome ruleset section (manual p.13, S-3 D7)", () => {
  it("is absent for a ruleset without the section and decoded for one with it", () => {
    expect(colonyIncomeFromRulesets([{ id: "production" }])).toBeUndefined();
    const decoded = colonyIncomeFromRulesets([ruleset("fixture", 2_500)]);
    expect(decoded?.ok && decoded.value.floorBp).toBe(2_500);
  });

  it("raises no diagnostic for a valid section through the validate stage", () => {
    const codes = stageCodes([ruleset("fixture", 2_500)]);
    expect(codes.filter((code) => code.startsWith("COLONY_INCOME"))).toEqual([]);
  });

  it("reports a floor above the start factor and two carriers through the validate stage", () => {
    expect(stageCodes([{ ...ruleset("fixture", 2_500) }].map(withFloorAboveStart))).toContain(
      "COLONY_INCOME_RULES_INVALID",
    );
    expect(stageCodes([ruleset("a", 2_500), ruleset("b", 2_500)])).toContain(
      "COLONY_INCOME_RULES_AMBIGUOUS",
    );
  });
});

function withFloorAboveStart(value: ReturnType<typeof ruleset>) {
  return { ...value, colonyIncome: { ...value.colonyIncome, startFactorBp: 2_000 } };
}
