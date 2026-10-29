import { describe, expect, it } from "vite-plus/test";
import {
  classificationRulesFromRecord,
  CLASSIFICATION_RULE_KEYS,
  type ClassFacts,
  type ClassificationRules,
} from "../src/classificationRules.js";
import {
  compileDesign,
  DESIGN_22_EARLY,
  type DesignDraft,
  type ShipContext,
} from "../src/index.js";
import { naturalClass } from "../src/classification.js";
import { UM_PER_KNOT } from "../src/units.js";
import { earlyContext, readReferenceDesignEntries, shipBalance } from "./helpers/earlyContext.js";

const OPENING_MONTH = "1880-01";

const scenarioRules = earlyContext(OPENING_MONTH).balance.classification!;

const designedSpeedUms = (milliKnots: number): number =>
  Math.floor((milliKnots * UM_PER_KNOT) / 1000);

const compileWith = (ctx: ShipContext, rules: ClassificationRules, draft: DesignDraft) =>
  compileDesign(draft, { ...ctx, balance: { ...ctx.balance, classification: rules } });

const designs = readReferenceDesignEntries() as {
  id: string;
  starterFor?: string;
  draft: DesignDraft;
}[];

describe("1880 scenario classification ruleset (ADR-0116)", () => {
  it("is authored in balance.ts, complete, and versioned", () => {
    expect(scenarioRules).toBeDefined();
    expect(() => classificationRulesFromRecord(scenarioRules)).not.toThrow();
    expect(Object.keys(scenarioRules).sort()).toEqual([...CLASSIFICATION_RULE_KEYS].sort());
    expect(scenarioRules.rulesetVersion).toBe(2);
  });

  it("differs from the canonical EARLY band only in the three intended B boundaries", () => {
    const changed = CLASSIFICATION_RULE_KEYS.filter(
      (k) => scenarioRules[k] !== DESIGN_22_EARLY[k],
    ).sort();
    expect(changed).toEqual(["bBeltMinUm", "bMaxSpeedUms", "bMinDisplacementKg", "rulesetVersion"]);
    expect(scenarioRules.bMinDisplacementKg).toBeLessThan(DESIGN_22_EARLY.bMinDisplacementKg);
    expect(scenarioRules.bBeltMinUm).toBeLessThan(DESIGN_22_EARLY.bBeltMinUm);
    expect(scenarioRules.bMaxSpeedUms).toBeLessThan(DESIGN_22_EARLY.bMaxSpeedUms);
  });

  it("admits a slow, belted, heavy-gun coast-defence ship that the canonical band rejects", () => {
    const facts: ClassFacts = {
      displacementKg: 1_968_000,
      speedUms: designedSpeedUms(7_500),
      beltUm: 140_000,
      anyQualifyingArmourUm: 140_000,
      maxMainGunUm: 283_000,
      mainTurretCount: 1,
      torpedoTubes: 0,
      aircraftCapacity: 0,
      deckUm: 25_000,
      maxHeavyMountBarrels: 2,
      maxGunUm: 283_000,
      merchantHull: false,
    };
    expect(naturalClass(facts, DESIGN_22_EARLY)).not.toBe("B");
    expect(naturalClass(facts, scenarioRules)).toBe("B");
  });

  it("only ever ADMITS: no existing classification is lost or changed", () => {
    const ctx = earlyContext(OPENING_MONTH);
    for (const d of designs) {
      const before = compileWith(ctx, DESIGN_22_EARLY, d.draft).naturalClass;
      const after = compileWith(ctx, scenarioRules, d.draft).naturalClass;
      if (before !== null) expect(after, d.id).toBe(before);
    }
  });

  it("leaves the uk/france/germany opening starters classifying exactly as before", () => {
    const ctx = earlyContext(OPENING_MONTH);
    const starterIds = new Set(designs.filter((d) => d.starterFor !== undefined).map((d) => d.id));
    const nations = ["uk", "france", "germany"];
    let checked = 0;
    for (const d of designs) {
      if (!starterIds.has(d.id) || !nations.includes(d.draft.nationId)) continue;
      checked++;
      const before = compileWith(ctx, DESIGN_22_EARLY, d.draft).naturalClass;
      const after = compileWith(ctx, scenarioRules, d.draft).naturalClass;
      expect(after, d.id).toBe(before);
    }
    expect(checked).toBeGreaterThanOrEqual(18);
  });

  it("keeps the domain's classification unchanged for a large battleship (relaxation is downward only)", () => {
    const facts: ClassFacts = {
      displacementKg: 9_492_000,
      speedUms: designedSpeedUms(15_100),
      beltUm: 305_000,
      anyQualifyingArmourUm: 305_000,
      maxMainGunUm: 279_000,
      mainTurretCount: 2,
      torpedoTubes: 0,
      aircraftCapacity: 0,
      deckUm: 38_000,
      maxHeavyMountBarrels: 2,
      maxGunUm: 279_000,
      merchantHull: false,
    };
    expect(naturalClass(facts, scenarioRules)).toBe("B");
    expect(naturalClass(facts, DESIGN_22_EARLY)).toBe("B");
  });

  it("is exposed through the loaded balance so the compile path and the roster agree", () => {
    const ctx = earlyContext(OPENING_MONTH);
    expect(ctx.balance.classification).toEqual(scenarioRules);
    expect(shipBalance.classification?.rulesetVersion).toBe(2);
  });

  it("classifies an authored design deterministically under the scenario ruleset", () => {
    const ctx = earlyContext(OPENING_MONTH);
    const draft = designs.find((d) => d.id === "alexandra_1877")!.draft;
    const a = compileWith(ctx, scenarioRules, draft);
    const b = compileWith(ctx, scenarioRules, draft);
    expect(a.hash).toBe(b.hash);
  });
});
