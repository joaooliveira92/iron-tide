import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { researchReturnsFromRulesets, ValidateStage } from "../src/index.js";
import type { ParseOutput } from "../src/stages/parse.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "16" }],
};

const ruleset = (id: string, aboveMarginalBp: number) => ({
  id,
  name: id,
  version: "1.0",
  researchReturns: { sectionVersion: 1, fullReturnShareBp: 1000, aboveMarginalBp, provenance },
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

describe("researchReturns ruleset section (manual p.16, S-3 D7)", () => {
  it("is absent for a ruleset without the section and decoded for one with it", () => {
    expect(researchReturnsFromRulesets([{ id: "production" }])).toBeUndefined();
    const decoded = researchReturnsFromRulesets([ruleset("fixture", 5000)]);
    expect(decoded?.ok && decoded.value.aboveMarginalBp).toBe(5000);
  });

  it("raises no diagnostic for a valid section through the validate stage", () => {
    const codes = stageCodes([ruleset("fixture", 5000)]);
    expect(codes.filter((code) => code.startsWith("RESEARCH_RETURNS"))).toEqual([]);
  });

  it("reports an out-of-range marginal rate and two carriers through the validate stage", () => {
    expect(stageCodes([ruleset("fixture", 10_001)])).toContain("RESEARCH_RETURNS_RULES_INVALID");
    expect(stageCodes([ruleset("a", 5000), ruleset("b", 5000)])).toContain(
      "RESEARCH_RETURNS_RULES_AMBIGUOUS",
    );
  });
});
