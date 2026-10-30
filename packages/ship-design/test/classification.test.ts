import { describe, it, expect } from "vite-plus/test";
import {
  classPredicates,
  CLASSIFIED_SHIP_TYPES,
  type ClassFacts,
} from "../src/classificationRules.js";
import {
  naturalClass,
  classificationFindings,
  classificationRejected,
  classFacts,
  classCode,
} from "../src/classification.js";
import {
  compileDesign,
  CLASSIFICATION_REJECTION_IDS,
  DESIGN_22_EARLY,
  UM_PER_INCH,
} from "../src/index.js";
import { checkFindingShape } from "../src/findings.js";
import { UM_PER_KNOT } from "../src/units.js";
import { ctx, draft } from "./fixtures/gunboat.js";

const R = DESIGN_22_EARLY;
const facts = (o: Partial<ClassFacts>): ClassFacts => ({
  displacementKg: 1_000_000,
  speedUms: 25 * UM_PER_KNOT,
  beltUm: 0,
  anyQualifyingArmourUm: 0,
  maxMainGunUm: 0,
  maxGunUm: 0,
  mainTurretCount: 0,
  torpedoTubes: 1,
  aircraftCapacity: 0,
  deckUm: 0,
  maxHeavyMountBarrels: 0,
  merchantHull: false,
  ...o,
});
const pass = (t: keyof typeof classPredicates, f: ClassFacts) =>
  classPredicates[t](f, R).length === 0;

describe("DESIGN-22 boundaries (strict versus inclusive)", () => {
  it("DD: below 2,000 t, strictly over 19 kn, a tube, no qualifying armour", () => {
    expect(pass("DD", facts({}))).toBe(true);
    expect(pass("DD", facts({ displacementKg: 1_999_999 }))).toBe(true);
    expect(pass("DD", facts({ displacementKg: 2_000_000 }))).toBe(false);
    expect(pass("DD", facts({ speedUms: 9_774_436 }))).toBe(false);
    expect(pass("DD", facts({ speedUms: 9_774_437 }))).toBe(true);
    expect(pass("DD", facts({ torpedoTubes: 0 }))).toBe(false);
    expect(pass("DD", facts({ anyQualifyingArmourUm: 50_799 }))).toBe(true);
    expect(pass("DD", facts({ anyQualifyingArmourUm: 50_800 }))).toBe(false);
  });
  it("CL: 2,000-8,000 t, over 16 kn, guns up to and including 6 inches", () => {
    const cl = facts({
      displacementKg: 5_000_000,
      speedUms: 17 * UM_PER_KNOT,
      maxMainGunUm: 6 * UM_PER_INCH,
    });
    expect(pass("CL", cl)).toBe(true);
    expect(pass("CL", { ...cl, displacementKg: 2_000_000 })).toBe(true);
    expect(pass("CL", { ...cl, displacementKg: 8_000_000 })).toBe(false);
    expect(pass("CL", { ...cl, maxMainGunUm: 6 * UM_PER_INCH + 1 })).toBe(false);
    expect(pass("CL", { ...cl, speedUms: 16 * UM_PER_KNOT })).toBe(false);
  });
  it("CA: over 4,000 t, over 19 kn, belt 2-12 in, guns over 6 and up to 11 in", () => {
    const ca = facts({
      displacementKg: 7_700_000,
      speedUms: 20 * UM_PER_KNOT,
      beltUm: 6 * UM_PER_INCH,
      maxMainGunUm: 9_200 * 25.4,
    });
    expect(pass("CA", ca)).toBe(true);
    expect(pass("CA", { ...ca, beltUm: 2 * UM_PER_INCH })).toBe(false);
    expect(pass("CA", { ...ca, beltUm: 12 * UM_PER_INCH })).toBe(true);
    expect(pass("CA", { ...ca, beltUm: 12 * UM_PER_INCH + 1 })).toBe(false);
    expect(pass("CA", { ...ca, maxMainGunUm: 11 * UM_PER_INCH })).toBe(true);
    expect(pass("CA", { ...ca, maxMainGunUm: 6 * UM_PER_INCH })).toBe(false);
  });
  it("B: slow, belted coast-defence type with 1-2 turrets; BB needs 3+ turrets and a belt over 6 in", () => {
    const b = facts({
      displacementKg: 6_000_000,
      speedUms: 15 * UM_PER_KNOT,
      beltUm: 8 * UM_PER_INCH,
      maxMainGunUm: 12 * UM_PER_INCH,
      mainTurretCount: 2,
    });
    expect(pass("B", b)).toBe(true);
    expect(pass("B", { ...b, speedUms: 20 * UM_PER_KNOT })).toBe(false);
    expect(pass("B", { ...b, mainTurretCount: 3 })).toBe(false);
    expect(pass("B", { ...b, beltUm: 6 * UM_PER_INCH })).toBe(true);
    const bb = facts({
      displacementKg: 14_900_000,
      speedUms: 17 * UM_PER_KNOT,
      beltUm: 9 * UM_PER_INCH,
      maxMainGunUm: 12 * UM_PER_INCH,
      mainTurretCount: 4,
    });
    expect(pass("BB", bb)).toBe(true);
    expect(pass("BB", { ...bb, beltUm: 6 * UM_PER_INCH })).toBe(false);
    expect(pass("BB", { ...bb, displacementKg: 8_000_000 })).toBe(false);
    expect(pass("BB", { ...bb, maxMainGunUm: 10 * UM_PER_INCH })).toBe(false);
  });
  it("KE: below 2,500 t, belt up to 2 in, any-role gun up to 6 in, no torpedoes", () => {
    const ke = facts({
      displacementKg: 1_500_000,
      beltUm: 2 * UM_PER_INCH,
      maxGunUm: 6 * UM_PER_INCH,
      torpedoTubes: 0,
    });
    expect(pass("KE", ke)).toBe(true);
    expect(pass("KE", { ...ke, displacementKg: 2_500_000 })).toBe(false);
    expect(pass("KE", { ...ke, beltUm: 2 * UM_PER_INCH + 1 })).toBe(false);
    expect(pass("KE", { ...ke, maxGunUm: 6 * UM_PER_INCH + 1 })).toBe(false);
    expect(pass("KE", { ...ke, torpedoTubes: 1 })).toBe(false);
    expect(pass("KE", { ...ke, maxGunUm: 0, maxMainGunUm: 0 })).toBe(true);
    expect(pass("KE", { ...ke, maxGunUm: 0, maxMainGunUm: 8 * UM_PER_INCH })).toBe(true);
  });
  it("AMC: above 1,700 t, merchant hull, no qualifying armour, any-role gun up to 6 in", () => {
    const amc = facts({ displacementKg: 3_000_000, merchantHull: true });
    expect(pass("AMC", amc)).toBe(true);
    expect(pass("AMC", { ...amc, displacementKg: 1_700_000 })).toBe(false);
    expect(pass("AMC", { ...amc, merchantHull: false })).toBe(false);
    expect(pass("AMC", { ...amc, anyQualifyingArmourUm: 2 * UM_PER_INCH })).toBe(false);
    expect(pass("AMC", { ...amc, maxGunUm: 6 * UM_PER_INCH })).toBe(true);
    expect(pass("AMC", { ...amc, maxGunUm: 6 * UM_PER_INCH + 1 })).toBe(false);
  });
  it("fills the manual's 2000 t gap: exactly 2000 t is naturally a light cruiser", () => {
    const twoThousand = facts({ displacementKg: 2_000_000 });
    expect(pass("DD", twoThousand)).toBe(false);
    expect(pass("CL", twoThousand)).toBe(true);
    expect(naturalClass(twoThousand, R)).toBe("CL");
  });
  it("keeps the locked types unclassifiable: a battlecruiser-like design is a BB, never a BC", () => {
    const battlecruiserLike = facts({
      displacementKg: 20_000_000,
      speedUms: 26 * UM_PER_KNOT,
      beltUm: 7 * UM_PER_INCH,
      maxMainGunUm: 12 * UM_PER_INCH,
      mainTurretCount: 4,
    });
    expect(naturalClass(battlecruiserLike, R)).toBe("BB");
    expect(CLASSIFIED_SHIP_TYPES as readonly string[]).not.toContain("BC");
    for (const locked of ["BC", "CV", "CVL", "AV", "SS", "MTB", "TR"])
      expect(CLASSIFIED_SHIP_TYPES as readonly string[]).not.toContain(locked);
  });
  it("natural class follows precedence BB > B > CA > CL > DD", () => {
    const slowBelted = facts({
      displacementKg: 9_000_000,
      speedUms: 15 * UM_PER_KNOT,
      beltUm: 9 * UM_PER_INCH,
      maxMainGunUm: 12 * UM_PER_INCH,
      mainTurretCount: 2,
    });
    expect(naturalClass(slowBelted, R)).toBe("B");
    expect(naturalClass({ ...slowBelted, mainTurretCount: 3 }, R)).toBe("BB");
    expect(naturalClass(facts({}), R)).toBe("DD");
    expect(
      naturalClass(
        facts({ displacementKg: 12_000_000, torpedoTubes: 0, speedUms: 5 * UM_PER_KNOT }),
        R,
      ),
    ).toBeNull();
  });
});

describe("protected-cruiser exception", () => {
  const nineInch = facts({
    displacementKg: 7_000_000,
    speedUms: 22 * UM_PER_KNOT,
    beltUm: 0,
    deckUm: 6 * UM_PER_INCH,
    maxMainGunUm: 9_200 * 25.4,
    mainTurretCount: 2,
    maxHeavyMountBarrels: 1,
  });
  const protectedEight = { ...nineInch, maxMainGunUm: 8 * UM_PER_INCH };
  it("is versioned data in the ruleset", () => {
    expect(R.protectedCruiserExceptionVersion).toBe(1);
    expect(R.clProtectedMaxGunUm).toBe(203_200);
  });
  it("lets a belt-less deck cruiser with single mounts up to exactly 8 in be CL", () => {
    expect(pass("CL", protectedEight)).toBe(true);
    expect(naturalClass(protectedEight, R)).toBe("CL");
    expect(pass("CL", { ...protectedEight, maxMainGunUm: 8 * UM_PER_INCH + 1 })).toBe(false);
    expect(pass("CL", { ...protectedEight, maxMainGunUm: 6 * UM_PER_INCH })).toBe(true);
  });
  it("rejects twin mounts, a main belt, or no armour deck above 6 in", () => {
    expect(pass("CL", { ...protectedEight, maxHeavyMountBarrels: 2 })).toBe(false);
    expect(pass("CL", { ...protectedEight, beltUm: 1 })).toBe(false);
    expect(pass("CL", { ...protectedEight, deckUm: 0 })).toBe(false);
  });
  it("does not move the displacement, speed or strict CA 6 in bounds", () => {
    expect(pass("CL", { ...protectedEight, displacementKg: 8_000_000 })).toBe(false);
    expect(pass("CL", { ...protectedEight, speedUms: 16 * UM_PER_KNOT })).toBe(false);
    const sixInchBelted = facts({
      displacementKg: 7_700_000,
      speedUms: 20 * UM_PER_KNOT,
      beltUm: 6 * UM_PER_INCH,
      maxMainGunUm: 6 * UM_PER_INCH,
    });
    expect(pass("CA", sixInchBelted)).toBe(false);
  });
  it("a 9.2 in single-mount ship declared CL is BLOCKING; the 8 in one has no finding", () => {
    expect(classificationFindings(nineInch, "CL", R).findings[0]!.id).toBe(
      "INTENDED_CLASSIFICATION_ILLEGAL",
    );
    expect(classificationFindings(protectedEight, "CL", R)).toEqual({
      natural: "CL",
      findings: [],
    });
  });
  it("is deterministic", () => {
    const a = JSON.stringify(classificationFindings(protectedEight, "CL", R));
    expect(JSON.stringify(classificationFindings({ ...protectedEight }, "CL", R))).toBe(a);
  });
});

describe("classification findings", () => {
  const f = facts({
    displacementKg: 7_700_000,
    speedUms: 20 * UM_PER_KNOT,
    beltUm: 6 * UM_PER_INCH,
    maxMainGunUm: 234_000,
  });
  it("a valid intended class gives no finding", () => {
    expect(classificationFindings(f, "CA", R)).toEqual({ natural: "CA", findings: [] });
  });
  it("illegal intended class is BLOCKING with reasons and remedies", () => {
    const r = classificationFindings(f, "BB", R);
    expect(r.findings[0]!.id).toBe("INTENDED_CLASSIFICATION_ILLEGAL");
    expect(r.findings[0]!.severity).toBe("BLOCKING");
    expect(checkFindingShape(r.findings[0]!)).toEqual([]);
    expect(r.findings[0]!.why).toContain("turrets");
  });
  it("legal but not the natural type is NATURAL_CLASSIFICATION_MISMATCH", () => {
    const mismatch = classificationFindings(
      facts({
        displacementKg: 6_000_000,
        speedUms: 19.5 * UM_PER_KNOT,
        beltUm: 8 * UM_PER_INCH,
        maxMainGunUm: 10 * UM_PER_INCH,
        mainTurretCount: 2,
      }),
      "CA",
      R,
    );
    expect(mismatch.natural).toBe("B");
    expect(mismatch.findings[0]!.id).toBe("NATURAL_CLASSIFICATION_MISMATCH");
  });
});

describe("classificationRejected (DESIGN-22 section 22 reclassification)", () => {
  const ca = facts({
    displacementKg: 7_700_000,
    speedUms: 20 * UM_PER_KNOT,
    beltUm: 6 * UM_PER_INCH,
    maxMainGunUm: 234_000,
  });
  it("names exactly the shipped mismatch-policy rejections", () => {
    expect([...CLASSIFICATION_REJECTION_IDS]).toEqual([
      "INTENDED_CLASSIFICATION_ILLEGAL",
      "NATURAL_CLASSIFICATION_MISMATCH",
      "NO_NATURAL_CLASSIFICATION_MATCH",
    ]);
  });
  it("accepts a design whose intended type still validates and is natural (type unchanged)", () => {
    const r = classificationFindings(ca, "CA", R);
    expect(r.natural).toBe("CA");
    expect(classificationRejected(r.findings)).toBe(false);
  });
  it("rejects an intended type that has become illegal", () => {
    const r = classificationFindings(ca, "BB", R);
    expect(classificationRejected(r.findings)).toBe(true);
  });
  it("rejects a design that no longer matches its natural type", () => {
    const merchantCruiser = facts({ displacementKg: 6_000_000, merchantHull: true });
    const r = classificationFindings(merchantCruiser, "CL", R);
    expect(r.natural).toBe("AMC");
    expect(classificationRejected(r.findings)).toBe(true);
  });
  it("rejects a design that matches no natural type", () => {
    const unmatched = facts({
      displacementKg: 12_000_000,
      torpedoTubes: 0,
      speedUms: 5 * UM_PER_KNOT,
    });
    const r = classificationFindings(unmatched, "CL", R);
    expect(r.natural).toBeNull();
    expect(classificationRejected(r.findings)).toBe(true);
  });
});

describe("compileDesign integration", () => {
  const as = (category: string) => ({ ...draft, requirement: { ...draft.requirement, category } });
  it("a torpedo-gunboat declared DD passes and reports its natural class", () => {
    const r = compileDesign(as("DD"), ctx);
    expect(r.valid).toBe(true);
    expect(r.naturalClass).toBe("DD");
    expect(classFacts(r, as("DD")).torpedoTubes).toBe(3);
  });
  it("the same ship declared CL is rejected (too small)", () => {
    const r = compileDesign(as("CL"), ctx);
    expect(r.valid).toBe(false);
    expect(r.findings.map((x) => x.id)).toContain("INTENDED_CLASSIFICATION_ILLEGAL");
  });
  it("armour that qualifies disqualifies a DD", () => {
    const armoured = {
      ...as("DD"),
      armour: {
        ...draft.armour,
        regions: draft.armour.regions.map((x) =>
          x.region === "DECK_MAIN" ? { ...x, thicknessUm: 60_000 } : x,
        ),
      },
    };
    expect(compileDesign(armoured, ctx).findings.map((x) => x.id)).toContain(
      "INTENDED_CLASSIFICATION_ILLEGAL",
    );
  });
  it("an unregistered category is a blocking SHIP_TYPE_UNREGISTERED finding, never silently unclassified", () => {
    const r = compileDesign(as("torpedo_gunboat"), ctx);
    expect(r.valid).toBe(false);
    expect(r.findings.map((x) => x.id)).toContain("SHIP_TYPE_UNREGISTERED");
    expect(r.findings.every((x) => checkFindingShape(x).length === 0)).toBe(true);
  });
});

describe("classCode", () => {
  const gun = (caliberUm: number, barrels?: number) =>
    ({
      category: "MAIN_GUN",
      attr: { caliberUm },
      params: barrels === undefined ? {} : { barrels },
    }) as never;
  it("is the type alone with no main guns", () => {
    expect(classCode("DD", [])).toBe("DD");
    expect(classCode("DD", [{ category: "RANGEFINDER", attr: {}, params: {} } as never])).toBe(
      "DD",
    );
  });
  it("counts mounts and the most barrels in a mount of the largest calibre", () => {
    expect(
      classCode("BB", [gun(305_000, 2), gun(305_000, 2), gun(305_000, 2), gun(305_000, 2)]),
    ).toBe("BB4X2");
    expect(classCode("CA", [gun(203_000, 1), gun(152_000, 2), gun(203_000, 2)])).toBe("CA3X2");
  });
  it("defaults to one barrel and is deterministic", () => {
    expect(classCode("CL", [gun(152_000)])).toBe("CL1X1");
    expect(classCode("CL", [gun(152_000)])).toBe(classCode("CL", [gun(152_000)]));
  });
  it("is in the workshop view for the declared type", () => {
    const c = compileDesign(draft, ctx);
    expect(classCode(draft.requirement.category, c.components)).toMatch(
      new RegExp(`^${draft.requirement.category}`),
    );
  });
});
