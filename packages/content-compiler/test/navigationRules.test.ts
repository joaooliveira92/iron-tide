import { describe, expect, it } from "vite-plus/test";
import { navigationFromRulesets, ValidateStage } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { ParseOutput } from "../src/stages/parse.js";

const klass = (grates: number, stokers: number, recovery: number) => ({
  gratesFouledOnsetMinutes: grates,
  stokersExhaustedOnsetMinutes: stokers,
  recoveryMinutes: recovery,
});

const complete = (): Record<string, unknown> => ({
  sectionVersion: 1,
  fouling: {
    cruiseSpeedPercent: 70,
    classes: { OIL: klass(90, 180, 200), COAL: klass(60, 120, 150), VTE: klass(40, 80, 100) },
  },
  breakdown: {
    baseChancePpm: 200,
    priorityChancePpm: 400,
    maxChancePpm: 2_000,
    repairMinutes: 20,
    repairSpeedCapPercent: 50,
  },
  vibration: { thresholdKnots: 25, gunneryMultiplierBp: 9_000 },
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [],
    note: "PROVISIONAL fixture-class value for tests only.",
  },
});

const ruleset = (navigation?: unknown, id = "core"): Record<string, unknown> => ({
  id,
  name: "Core",
  version: "1.0",
  ...(navigation === undefined ? {} : { navigation }),
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

describe("navigation ruleset section (#937)", () => {
  it("is dormant when absent: no diagnostic and no decoded section", () => {
    expect(codes(validate([ruleset()])).filter((code) => code.startsWith("NAVIGATION"))).toEqual(
      [],
    );
    expect(navigationFromRulesets([ruleset()])).toBeUndefined();
  });

  it("accepts a complete, ordered section", () => {
    expect(validate([ruleset(complete())]).hasErrors).toBe(false);
    const decoded = navigationFromRulesets([ruleset(complete())]);
    expect(decoded?.ok).toBe(true);
  });

  it("names a missing field in an entity-tagged error", () => {
    const { vibration: _omitted, ...rest } = complete();
    const d = validate([ruleset(rest)]).all.find((x) => x.code === "NAVIGATION_RULES_INVALID");
    expect(d?.severity).toBe("error");
    expect(d?.entityId).toBe("core");
    expect(d?.message).toContain("vibration");
  });

  it("enforces oil < coal < VTE sensitivity as a validation error", () => {
    const section = complete() as { fouling: { classes: Record<string, unknown> } };
    section.fouling.classes["COAL"] = klass(95, 190, 220);
    const d = validate([ruleset(section)]).all.find(
      (x) => x.code === "NAVIGATION_RULES_ORDERING_INVALID",
    );
    expect(d?.severity).toBe("error");
    expect(d?.message).toContain("fouling.classes.COAL.gratesFouledOnsetMinutes");
  });

  it("rejects two rulesets carrying the section", () => {
    const result = validate([ruleset(complete(), "a"), ruleset(complete(), "b")]);
    expect(codes(result)).toContain("NAVIGATION_RULES_AMBIGUOUS");
  });
});
