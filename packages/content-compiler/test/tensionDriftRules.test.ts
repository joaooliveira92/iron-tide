import { ValidateStage } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { tensionDriftFromRulesets } from "../src/index.js";
import type { ParseOutput } from "../src/stages/parse.js";

const FIXTURE_TENSION_DRIFT = {
  sectionVersion: 1,
  maxRiseProbabilityBp: 150,
  navalRatio: { thresholdBp: 20_000, pressureBp: 40, tensionCeiling: 6 },
  damping: { alliedBp: 60, tradeAgreementBp: 25 },
  cooling: { alliedBp: 30, tradeAgreementBp: 15 },
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [],
    note: "Fixture-class value for tests only.",
  },
};

const ruleset = (id: string, tensionDrift?: unknown): Record<string, unknown> => ({
  id,
  name: id,
  version: "1.0",
  ...(tensionDrift === undefined ? {} : { tensionDrift }),
});

function validate(rulesets: unknown[]): DiagnosticCollector {
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
  return collector;
}

const codes = (c: DiagnosticCollector): string[] => c.all.map((d) => d.code as string);

describe("tensionDriftFromRulesets", () => {
  it("is dormant when no ruleset carries the section", () => {
    expect(tensionDriftFromRulesets([])).toBeUndefined();
    expect(tensionDriftFromRulesets([ruleset("core")])).toBeUndefined();
  });

  it("returns the strictly decoded section", () => {
    expect(
      tensionDriftFromRulesets([ruleset("core"), ruleset("drift", FIXTURE_TENSION_DRIFT)]),
    ).toEqual({ ok: true, value: FIXTURE_TENSION_DRIFT });
  });

  it("reports a section that does not decode, naming the field", () => {
    const decoded = tensionDriftFromRulesets([ruleset("core", { sectionVersion: 1 })]);
    expect(decoded?.ok).toBe(false);
    if (decoded !== undefined && !decoded.ok)
      expect(decoded.field).toContain("maxRiseProbabilityBp");
  });
});

describe("tensionDrift ruleset section validation", () => {
  it("accepts a ruleset with no section and one with a complete section", () => {
    expect(codes(validate([ruleset("core")]))).not.toContain("TENSION_DRIFT_RULES_INVALID");
    expect(codes(validate([ruleset("core", FIXTURE_TENSION_DRIFT)]))).toEqual([]);
  });

  it("rejects an incomplete section naming the ruleset", () => {
    const collector = validate([ruleset("core", { ...FIXTURE_TENSION_DRIFT, damping: undefined })]);
    expect(codes(collector)).toContain("TENSION_DRIFT_RULES_INVALID");
    expect(collector.all.find((d) => d.code === "TENSION_DRIFT_RULES_INVALID")?.message).toContain(
      "core",
    );
  });

  it("rejects two rulesets that both carry the section", () => {
    const collector = validate([
      ruleset("a", FIXTURE_TENSION_DRIFT),
      ruleset("b", FIXTURE_TENSION_DRIFT),
    ]);
    expect(codes(collector)).toContain("TENSION_DRIFT_RULES_AMBIGUOUS");
  });
});
