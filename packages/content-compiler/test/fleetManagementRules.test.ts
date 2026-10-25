import { describe, expect, it } from "vite-plus/test";
import { fleetManagementFromRulesets, ValidateStage } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { ParseOutput } from "../src/stages/parse.js";

const subject = (maintenanceAdderBp: number) => ({ maintenanceAdderBp, effectBp: 1_000 });

const complete = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  sectionVersion: 1,
  divisionCohesion: { monthlyGrowth: 2, cap: 90 },
  divisionExperience: { perBattle: 3, perExercise: 5 },
  reorganisationPenalty: {
    roleChange: { cohesion: 10, experience: 0 },
    formationChange: { cohesion: 5, experience: 0 },
  },
  training: {
    proficiencyMonths: 12,
    maxSubjects: 2,
    subjects: {
      GUNNERY: subject(3_000),
      NIGHT_FIGHTING: subject(2_000),
      TORPEDO_TACTICS: subject(2_000),
      DAMAGE_CONTROL: subject(2_000),
    },
  },
  exercise: { maintenanceMultiple: 2, maxPerCalendarYear: 1 },
  provenance: {
    sourceStatus: "BALANCE_TARGET",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [],
    note: "Fixture-class value for tests only.",
  },
  ...extra,
});

const ruleset = (fleetManagement?: unknown, id = "core"): Record<string, unknown> => ({
  id,
  name: "Core",
  version: "1.0",
  ...(fleetManagement === undefined ? {} : { fleetManagement }),
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
const invalid = (section: unknown): boolean =>
  codes(validate([ruleset(section)])).includes("FLEET_MANAGEMENT_RULES_INVALID");

describe("fleet-management ruleset section", () => {
  it("is dormant when absent: no diagnostic", () => {
    const c = validate([ruleset()]);
    expect(codes(c).filter((code) => code.startsWith("FLEET_MANAGEMENT"))).toEqual([]);
  });

  it("accepts a complete section", () => {
    expect(validate([ruleset(complete())]).hasErrors).toBe(false);
  });

  it("names a missing field in a named, entity-tagged error diagnostic", () => {
    for (const field of [
      "sectionVersion",
      "divisionCohesion",
      "divisionExperience",
      "reorganisationPenalty",
      "training",
      "exercise",
      "provenance",
    ]) {
      const { [field]: _omitted, ...rest } = complete();
      const d = validate([ruleset(rest)]).all.find(
        (x) => x.code === "FLEET_MANAGEMENT_RULES_INVALID",
      );
      expect(d?.severity).toBe("error");
      expect(d?.entityId).toBe("core");
      expect(d?.message).toContain(field);
    }
  });

  it("rejects excess keys at the root and in nested objects", () => {
    expect(invalid(complete({ surprise: 1 }))).toBe(true);
    const c = complete() as Record<string, Record<string, unknown>>;
    for (const key of ["divisionCohesion", "divisionExperience", "exercise", "training"]) {
      expect(invalid({ ...c, [key]: { ...c[key], surprise: 1 } })).toBe(true);
    }
  });

  it("rejects non-integer, out-of-range and unknown-subject values", () => {
    const c = complete() as Record<string, Record<string, unknown>>;
    const sub = (key: string, patch: Record<string, unknown>) => ({
      ...c,
      [key]: { ...c[key], ...patch },
    });
    const bad: unknown[] = [
      complete({ sectionVersion: 2 }),
      sub("divisionCohesion", { monthlyGrowth: 1.5 }),
      sub("divisionCohesion", { cap: 101 }),
      sub("divisionExperience", { perBattle: -1 }),
      sub("reorganisationPenalty", { roleChange: { cohesion: 10 } }),
      sub("training", { proficiencyMonths: 0 }),
      sub("training", { maxSubjects: 5 }),
      sub("training", {
        subjects: { ...(c["training"]?.["subjects"] as object), SEAMANSHIP: subject(1) },
      }),
      sub("training", {
        subjects: { ...(c["training"]?.["subjects"] as object), GUNNERY: subject(10_001) },
      }),
      sub("exercise", { maintenanceMultiple: 0 }),
      sub("exercise", { maxPerCalendarYear: -1 }),
    ];
    for (const section of bad) expect(invalid(section)).toBe(true);
  });

  it("rejects two carriers as ambiguous", () => {
    const c = validate([ruleset(complete(), "a"), ruleset(complete(), "b")]);
    expect(codes(c)).toContain("FLEET_MANAGEMENT_RULES_AMBIGUOUS");
  });
});

describe("fleetManagementFromRulesets", () => {
  it("is dormant when no ruleset carries the section", () => {
    expect(fleetManagementFromRulesets([])).toBeUndefined();
    expect(fleetManagementFromRulesets([{ id: "core" }])).toBeUndefined();
  });

  it("returns the strictly decoded section", () => {
    expect(fleetManagementFromRulesets([{ id: "core" }, ruleset(complete(), "fm")])).toEqual({
      ok: true,
      value: complete(),
    });
  });

  it("reports a section that does not decode, naming the field", () => {
    const decoded = fleetManagementFromRulesets([
      { id: "core", fleetManagement: { sectionVersion: 1 } },
    ]);
    expect(decoded?.ok).toBe(false);
    if (decoded !== undefined && !decoded.ok) expect(decoded.field).toBe("divisionCohesion");
  });
});
