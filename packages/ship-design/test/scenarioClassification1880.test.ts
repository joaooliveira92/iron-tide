// ADR-0116: the 1880 scenario authors a per-scenario classification ruleset (balance.yaml `ship.classification`)
// that admits slow, belted, heavy-gun coast-defence/casemate ironclads as capital (B) ships. These tests pin that
// the authored ruleset is complete and versioned, that it differs from the canonical EARLY band only in the three
// intended boundaries, and — crucially — that it does NOT reclassify any existing design (uk/france/germany
// starters included), so it can only ever admit the intended ships.
import { describe, expect, it } from "vite-plus/test";
import {
  classificationRulesFromRecord,
  CLASSIFICATION_RULE_KEYS,
  compileDesign,
  DESIGN_22_EARLY,
  naturalClass,
  UM_PER_KNOT,
  type ClassFacts,
  type ClassificationRules,
  type DesignDraft,
  type ShipContext,
} from "../src/index.js";
import { earlyContext, readReferenceDesignEntries, shipBalance } from "./helpers/earlyContext.js";

const OPENING_MONTH = "1880-01";

const scenarioRules = earlyContext(OPENING_MONTH).balance.classification!;

/** Designed speed in canonical µm/s from milli-knots, exactly as `classFacts` derives it. */
const designedSpeedUms = (milliKnots: number): number =>
  Math.floor((milliKnots * UM_PER_KNOT) / 1000);

/** Compile a draft under a chosen ruleset without mutating the shared context. */
const compileWith = (ctx: ShipContext, rules: ClassificationRules, draft: DesignDraft) =>
  compileDesign(draft, { ...ctx, balance: { ...ctx.balance, classification: rules } });

const designs = readReferenceDesignEntries() as {
  id: string;
  starterFor?: string;
  draft: DesignDraft;
}[];

describe("1880 scenario classification ruleset (ADR-0116)", () => {
  it("is authored in balance.yaml, complete, and versioned", () => {
    expect(scenarioRules).toBeDefined();
    // The authored ruleset is a full ClassificationRules: every key present and a finite number.
    expect(() => classificationRulesFromRecord(scenarioRules)).not.toThrow();
    expect(Object.keys(scenarioRules).sort()).toEqual([...CLASSIFICATION_RULE_KEYS].sort());
    expect(scenarioRules.rulesetVersion).toBe(2);
  });

  it("differs from the canonical EARLY band only in the three intended B boundaries", () => {
    const changed = CLASSIFICATION_RULE_KEYS.filter(
      (k) => scenarioRules[k] !== DESIGN_22_EARLY[k],
    ).sort();
    expect(changed).toEqual(["bBeltMinUm", "bMaxSpeedUms", "bMinDisplacementKg", "rulesetVersion"]);
    // The relaxation only ever ADMITS ships the canonical band rejected (a lower floor and thinner belt)...
    expect(scenarioRules.bMinDisplacementKg).toBeLessThan(DESIGN_22_EARLY.bMinDisplacementKg);
    expect(scenarioRules.bBeltMinUm).toBeLessThan(DESIGN_22_EARLY.bBeltMinUm);
    // ...while the speed bound is tightened, so a cruiser faster than 16 kn cannot be captured as B.
    expect(scenarioRules.bMaxSpeedUms).toBeLessThan(DESIGN_22_EARLY.bMaxSpeedUms);
  });

  it("admits a slow, belted, heavy-gun coast-defence ship that the canonical band rejects", () => {
    // Matador-like monitor: 1,968 t, 140 mm belt, 283 mm gun, 7.5 kn, one twin mount.
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
      // A design the canonical band already classified keeps that class; the ruleset can only add a class to a
      // design the canonical band left unclassified (the intended coast-defence admission).
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
    // At least six starters per nation — the guard must not pass vacuously (uk carries extra designs).
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
    // The same object the loader parses is what `classFacts`/`shipTypeEnvelope` read.
    const ctx = earlyContext(OPENING_MONTH);
    expect(ctx.balance.classification).toEqual(scenarioRules);
    // `shipBalance` is the parsed balance.yaml `ship` section: the field really is authored content, not code.
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
