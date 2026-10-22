import { describe, expect, it } from "vite-plus/test";
import { ValidateStage } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import type { ParseOutput } from "../src/stages/parse.js";

const FIXTURE_PROVENANCE = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "Fixture-class value for tests only.",
};

const complete = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  sectionVersion: 1,
  estimateModel: {
    kind: "PERTURBED",
    errorBoundBp: 1_500,
    rounding: "FLOOR",
    showComposition: false,
  },
  declineVictoryPoints: {
    pointsByMission: { FLEET_BATTLE: 3, COASTAL_RAID: 1 },
    distanceModifier: { kind: "REDUCTION_BP", measure: "fixture-distance", reductionBp: 5_000 },
    rounding: "CEIL",
    opponentCredit: { kind: "FRACTION_BP", fractionBp: 2_500 },
  },
  declineCounter: {
    threshold: 3,
    scope: "WAR",
    reset: { kind: "DECAY", countRemoved: 1, perMonths: 6 },
  },
  enemyDecline: {
    comparison: "LESS_THAN",
    thresholdBp: 5_000,
    probabilityBp: 4_000,
    enemyCostPoints: 1,
  },
  supportForce: { presenceChanceBp: 3_000, shareOfCapBp: 2_500, source: "ALLIED_ONLY" },
  provenance: FIXTURE_PROVENANCE,
  ...extra,
});

const ruleset = (battleOffers?: unknown, id = "core"): Record<string, unknown> => ({
  id,
  name: "Core",
  version: "1.0",
  ...(battleOffers === undefined ? {} : { battleOffers }),
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
  codes(validate([ruleset(section)])).includes("BATTLE_OFFER_RULES_INVALID");

describe("T-1 battle-offer ruleset section", () => {
  it("is dormant when absent: no diagnostic", () => {
    const c = validate([ruleset()]);
    expect(codes(c).filter((code) => code.startsWith("BATTLE_OFFER"))).toEqual([]);
  });

  it("accepts a complete fixture-class section, with and without the prestige sub-rule", () => {
    expect(validate([ruleset(complete())]).hasErrors).toBe(false);
    const withPrestige = complete({
      declinedBattlePrestige: {
        rule: { kind: "PROPORTIONAL_LOSS", basisPoints: 100 },
        repeat: "ONCE_AT_THRESHOLD",
      },
    });
    expect(validate([ruleset(withPrestige)]).hasErrors).toBe(false);
  });

  it("accepts every estimate-model and counter-reset variant", () => {
    for (const estimateModel of [
      { kind: "EXACT", showComposition: true },
      { kind: "BANDED", bandWidthStrength: 10, rounding: "HALF_UP", showComposition: false },
    ]) {
      expect(invalid(complete({ estimateModel }))).toBe(false);
    }
    for (const reset of [{ kind: "NONE" }, { kind: "ON_WAR_END" }]) {
      const base = complete();
      expect(invalid({ ...base, declineCounter: { threshold: 2, scope: "NATION", reset } })).toBe(
        false,
      );
    }
  });

  it("names a missing field in a named, entity-tagged error diagnostic", () => {
    for (const field of [
      "sectionVersion",
      "estimateModel",
      "declineVictoryPoints",
      "declineCounter",
      "enemyDecline",
      "supportForce",
      "provenance",
    ]) {
      const { [field]: _omitted, ...rest } = complete();
      const d = validate([ruleset(rest)]).all.find((x) => x.code === "BATTLE_OFFER_RULES_INVALID");
      expect(d?.severity).toBe("error");
      expect(d?.entityId).toBe("core");
      expect(d?.message).toContain(field);
    }
    expect(invalid({})).toBe(true);
  });

  it("rejects excess keys at the root and in every nested object", () => {
    expect(invalid(complete({ surprise: 1 }))).toBe(true);
    const c = complete() as Record<string, Record<string, unknown>>;
    for (const key of [
      "estimateModel",
      "declineVictoryPoints",
      "declineCounter",
      "enemyDecline",
      "supportForce",
    ]) {
      expect(invalid({ ...c, [key]: { ...c[key], surprise: 1 } })).toBe(true);
    }
  });

  it("rejects non-integer, out-of-range and wrongly-typed values per field", () => {
    const c = complete() as Record<string, Record<string, unknown>>;
    const sub = (key: string, patch: Record<string, unknown>) => ({
      ...c,
      [key]: { ...c[key], ...patch },
    });
    const bad: unknown[] = [
      complete({ sectionVersion: 2 }),
      complete({ estimateModel: { kind: "GUESS" } }),
      complete({
        estimateModel: {
          kind: "PERTURBED",
          errorBoundBp: 10_001,
          rounding: "FLOOR",
          showComposition: true,
        },
      }),
      complete({
        estimateModel: {
          kind: "PERTURBED",
          errorBoundBp: 1.5,
          rounding: "FLOOR",
          showComposition: true,
        },
      }),
      complete({
        estimateModel: {
          kind: "PERTURBED",
          errorBoundBp: 10,
          rounding: "ROUND",
          showComposition: true,
        },
      }),
      complete({
        estimateModel: {
          kind: "BANDED",
          bandWidthStrength: 0,
          rounding: "FLOOR",
          showComposition: true,
        },
      }),
      complete({ estimateModel: { kind: "EXACT", showComposition: "yes" } }),
      sub("declineVictoryPoints", { pointsByMission: { FLEET_BATTLE: -1 } }),
      sub("declineVictoryPoints", { pointsByMission: { FLEET_BATTLE: 1.5 } }),
      sub("declineVictoryPoints", { rounding: "TRUNC" }),
      sub("declineVictoryPoints", { opponentCredit: { kind: "FRACTION_BP", fractionBp: 10_001 } }),
      sub("declineVictoryPoints", { opponentCredit: { kind: "HALF" } }),
      sub("declineVictoryPoints", {
        distanceModifier: { kind: "REDUCTION_BP", measure: "", reductionBp: 1 },
      }),
      sub("declineVictoryPoints", {
        distanceModifier: { kind: "REDUCTION_BP", measure: "m", reductionBp: -1 },
      }),
      sub("declineCounter", { threshold: 0 }),
      sub("declineCounter", { scope: "FLEET" }),
      sub("declineCounter", { reset: { kind: "DECAY", countRemoved: 0, perMonths: 1 } }),
      sub("declineCounter", { reset: { kind: "DECAY", countRemoved: 1, perMonths: 1.5 } }),
      sub("enemyDecline", { comparison: "EQUAL" }),
      sub("enemyDecline", { thresholdBp: -1 }),
      sub("enemyDecline", { probabilityBp: 10_001 }),
      sub("enemyDecline", { enemyCostPoints: -1 }),
      sub("supportForce", { presenceChanceBp: 10_001 }),
      sub("supportForce", { shareOfCapBp: 5_001 }),
      sub("supportForce", { shareOfCapBp: 2.5 }),
      sub("supportForce", { source: "ANY" }),
      complete({
        declinedBattlePrestige: {
          rule: { kind: "PROPORTIONAL_LOSS", basisPoints: 10_001 },
          repeat: "ONCE_AT_THRESHOLD",
        },
      }),
      complete({
        declinedBattlePrestige: {
          rule: { kind: "FIXED_LOSS", amount: -1 },
          repeat: "ONCE_AT_THRESHOLD",
        },
      }),
      complete({
        declinedBattlePrestige: { rule: { kind: "FIXED_LOSS", amount: 1 }, repeat: "ALWAYS" },
      }),
      complete({ declinedBattlePrestige: { rule: { kind: "FIXED_LOSS", amount: 1 } } }),
    ];
    for (const section of bad) expect(invalid(section)).toBe(true);
  });

  it("rejects two rulesets that both carry a section: it is never guessed which one applies", () => {
    const c = validate([ruleset(complete()), ruleset(complete(), "other")]);
    expect(codes(c)).toContain("BATTLE_OFFER_RULES_AMBIGUOUS");
  });
});
