import { ValidateStage } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { tradeProtectionFromRulesets } from "../src/index.js";
import type { ParseOutput } from "../src/stages/parse.js";

const FIXTURE_TRADE_PROTECTION = {
  sectionVersion: 1,
  fleetShareBp: 1000,
  resourcesPerRequiredShip: 400,
  contributingHullTypes: ["destroyer"],
  raiderHullTypes: ["protected_cruiser", "armed_merchant_cruiser"],
  amcHullType: "armed_merchant_cruiser",
  amcMinSpeedUms: 4_115_552,
  raiderHitBp: 1500,
  shortfallAmplifyBp: 5000,
  lossPerHitBp: 150,
  pressureChanceBp: 1500,
  pressureLossBp: 100,
  recoveryBpPerMonth: 50,
  revenueSensitivityBp: 5000,
  unrestThresholdBp: 1500,
  unrestCadenceMonths: 3,
  unrestStep: 1,
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [],
    note: "Fixture-class value for tests only.",
  },
};

const ruleset = (id: string, tradeProtection?: unknown): Record<string, unknown> => ({
  id,
  name: id,
  version: "1.0",
  ...(tradeProtection === undefined ? {} : { tradeProtection }),
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

describe("tradeProtectionFromRulesets", () => {
  it("is dormant when no ruleset carries the section", () => {
    expect(tradeProtectionFromRulesets([])).toBeUndefined();
    expect(tradeProtectionFromRulesets([ruleset("core")])).toBeUndefined();
  });

  it("returns the strictly decoded section", () => {
    expect(
      tradeProtectionFromRulesets([ruleset("core"), ruleset("trade", FIXTURE_TRADE_PROTECTION)]),
    ).toEqual({ ok: true, value: FIXTURE_TRADE_PROTECTION });
  });

  it("reports a section that does not decode, naming the field", () => {
    const decoded = tradeProtectionFromRulesets([ruleset("core", { sectionVersion: 1 })]);
    expect(decoded?.ok).toBe(false);
    if (decoded !== undefined && !decoded.ok) expect(decoded.field).toContain("fleetShareBp");
  });
});

describe("tradeProtection ruleset section validation", () => {
  it("accepts a ruleset with no section and one with a complete section", () => {
    expect(codes(validate([ruleset("core")]))).not.toContain("TRADE_PROTECTION_RULES_INVALID");
    expect(codes(validate([ruleset("core", FIXTURE_TRADE_PROTECTION)]))).toEqual([]);
  });

  it("rejects an incomplete section naming the ruleset", () => {
    const collector = validate([
      ruleset("core", { ...FIXTURE_TRADE_PROTECTION, raiderHitBp: undefined }),
    ]);
    expect(codes(collector)).toContain("TRADE_PROTECTION_RULES_INVALID");
    expect(
      collector.all.find((d) => d.code === "TRADE_PROTECTION_RULES_INVALID")?.message,
    ).toContain("core");
  });

  it("rejects an AMC hull type that is not among the raider hull types", () => {
    const collector = validate([
      ruleset("core", { ...FIXTURE_TRADE_PROTECTION, raiderHullTypes: ["protected_cruiser"] }),
    ]);
    expect(codes(collector)).toContain("TRADE_PROTECTION_AMC_NOT_RAIDER");
    expect(
      collector.all.find((d) => d.code === "TRADE_PROTECTION_AMC_NOT_RAIDER")?.message,
    ).toContain("core");
  });

  it("rejects two rulesets that both carry the section", () => {
    const collector = validate([
      ruleset("a", FIXTURE_TRADE_PROTECTION),
      ruleset("b", FIXTURE_TRADE_PROTECTION),
    ]);
    expect(codes(collector)).toContain("TRADE_PROTECTION_RULES_AMBIGUOUS");
  });
});
