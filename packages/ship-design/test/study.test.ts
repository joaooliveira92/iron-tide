import { describe, expect, it } from "vite-plus/test";
import {
  assessSimilarity,
  checkStudyBalance,
  StudyContractError,
  studyTerms,
  type SimilarityProfile,
} from "../src/index.js";

const base: SimilarityProfile = {
  hullCategory: "SURFACE_COMBATANT",
  hullFormId: "battleship_form",
  fuelType: "COAL",
  displacementKg: 12_000_000,
  speedMilliKnots: 17_000,
  mainCaliberUm: 304_800,
  mainMounts: 2,
  mainMaxBarrelsPerMount: 2,
  mainBarrels: 4,
  secondaryMaxCaliberUm: 152_400,
  secondaryBarrels: 12,
  secondaryWeightKg: 200_000,
  secondaryDualPurpose: false,
  armourUm: { BELT_MAIN: 229_000, DECK_MAIN: 76_000 },
};
const sim = (over: Partial<SimilarityProfile>) => assessSimilarity(base, { ...base, ...over });
const balance = checkStudyBalance({
  costBp: 300,
  baseWorkMonths: 4,
  derivedDiscountBp: 2_500,
  minFinalWork: 1,
  minFinalCost: 1,
});

describe("similarity (DESIGN-21 sections 10-16, acceptance 4-16)", () => {
  it("an identical design is similar; cosmetic fields are not compared at all", () => {
    expect(sim({})).toEqual({ derived: true, failed: [] });
  });
  it("displacement: the greater of 10 % or 1,000 t, equality similar; a fall of more than 20 % breaks it", () => {
    expect(sim({ displacementKg: 13_200_000 }).derived).toBe(true); // +10 % = 1,200 t, exactly
    expect(sim({ displacementKg: 13_200_001 }).failed).toEqual([
      "DERIVED_DESIGN_DISPLACEMENT_CHANGED",
    ]);
    const small = { ...base, displacementKg: 2_000_000 };
    expect(assessSimilarity(small, { ...small, displacementKg: 3_000_000 }).derived).toBe(true); // 1,000 t floor
    expect(assessSimilarity(small, { ...small, displacementKg: 3_000_001 }).derived).toBe(false);
    expect(sim({ displacementKg: 9_600_000 }).derived).toBe(true); // exactly -20 %
    expect(sim({ displacementKg: 9_599_999 }).derived).toBe(false);
  });
  it("main battery: one inch, one turret, one barrel per turret, 25 % of barrels with a minimum of two", () => {
    expect(sim({ mainCaliberUm: 330_200 }).derived).toBe(true); // +1 inch exactly
    expect(sim({ mainCaliberUm: 330_201 }).failed).toEqual(["DERIVED_DESIGN_MAIN_BATTERY_CHANGED"]);
    expect(sim({ mainMounts: 3, mainBarrels: 6 }).derived).toBe(true); // +1 turret, +2 barrels (minimum allowance)
    expect(sim({ mainMounts: 4 }).derived).toBe(false);
    expect(sim({ mainMaxBarrelsPerMount: 3, mainBarrels: 6 }).derived).toBe(true);
    expect(sim({ mainMaxBarrelsPerMount: 4 }).derived).toBe(false);
    expect(sim({ mainBarrels: 7 }).derived).toBe(false);
    const big = { ...base, mainBarrels: 12 };
    expect(assessSimilarity(big, { ...big, mainBarrels: 15 }).derived).toBe(true); // 25 % of 12 = 3
    expect(assessSimilarity(big, { ...big, mainBarrels: 16 }).derived).toBe(false);
  });
  it("secondary: half inch, 33 % (min 4), 25 % weight, six-inch group, dual-purpose family, zero baseline", () => {
    const fiveInch = { ...base, secondaryMaxCaliberUm: 127_000 };
    expect(
      assessSimilarity(fiveInch, { ...fiveInch, secondaryMaxCaliberUm: 139_700 }).derived,
    ).toBe(true); // +0.5 in
    expect(
      assessSimilarity(fiveInch, { ...fiveInch, secondaryMaxCaliberUm: 139_701 }).derived,
    ).toBe(false);
    // From exactly six inches, any rise adds a group above six inches: major even within half an inch.
    expect(sim({ secondaryMaxCaliberUm: 152_401 }).derived).toBe(false);
    expect(sim({ secondaryBarrels: 16 }).derived).toBe(true); // 33 % of 12 = 3, minimum 4
    expect(sim({ secondaryBarrels: 17 }).derived).toBe(false);
    expect(sim({ secondaryWeightKg: 250_000 }).derived).toBe(true); // +25 % exactly
    expect(sim({ secondaryWeightKg: 250_001 }).derived).toBe(false);
    expect(sim({ secondaryDualPurpose: true }).failed).toEqual([
      "DERIVED_DESIGN_SECONDARY_BATTERY_CHANGED",
    ]);
    const none = { ...base, secondaryBarrels: 0, secondaryMaxCaliberUm: 0, secondaryWeightKg: 0 };
    expect(
      assessSimilarity(none, { ...none, secondaryBarrels: 4, secondaryMaxCaliberUm: 127_000 })
        .derived,
    ).toBe(true);
    expect(assessSimilarity(none, { ...none, secondaryBarrels: 5 }).derived).toBe(false);
    expect(
      assessSimilarity(none, { ...none, secondaryBarrels: 1, secondaryMaxCaliberUm: 127_001 })
        .derived,
    ).toBe(false);
  });
  it("speed one knot and armour one inch vertical / half inch horizontal, equality similar", () => {
    expect(sim({ speedMilliKnots: 18_000 }).derived).toBe(true);
    expect(sim({ speedMilliKnots: 18_001 }).failed).toEqual(["DERIVED_DESIGN_SPEED_CHANGED"]);
    expect(sim({ armourUm: { BELT_MAIN: 254_400, DECK_MAIN: 76_000 } }).derived).toBe(true);
    expect(sim({ armourUm: { BELT_MAIN: 254_401, DECK_MAIN: 76_000 } }).failed).toEqual([
      "DERIVED_DESIGN_VERTICAL_ARMOR_CHANGED",
    ]);
    expect(sim({ armourUm: { BELT_MAIN: 229_000, DECK_MAIN: 88_700 } }).derived).toBe(true);
    expect(sim({ armourUm: { BELT_MAIN: 229_000, DECK_MAIN: 88_701 } }).failed).toEqual([
      "DERIVED_DESIGN_HORIZONTAL_ARMOR_CHANGED",
    ]);
    // Adding a zone counts from zero.
    expect(sim({ armourUm: { ...base.armourUm, TURRET: 25_400 } }).derived).toBe(true);
    expect(sim({ armourUm: { ...base.armourUm, TURRET: 25_401 } }).derived).toBe(false);
  });
  it("hull category, fuel family and hull form changes break similarity, in a fixed order", () => {
    expect(sim({ hullCategory: "AUXILIARY" }).failed).toEqual([
      "DERIVED_DESIGN_HULL_CATEGORY_CHANGED",
    ]);
    expect(sim({ fuelType: "OIL" }).failed).toEqual(["DERIVED_DESIGN_SPECIAL_FEATURE_CHANGED"]);
    expect(sim({ speedMilliKnots: 30_000, displacementKg: 20_000_000 }).failed).toEqual([
      "DERIVED_DESIGN_DISPLACEMENT_CHANGED",
      "DERIVED_DESIGN_SPEED_CHANGED",
    ]);
  });
});

describe("study terms (sections 3 and 18)", () => {
  it("a new design pays the base; a derived one gets the discount, rounded up", () => {
    expect(studyTerms(125, false, balance)).toEqual({
      baseStudyWork: 4,
      baseStudyCost: 4, // ceil(125 x 3 %) = ceil(3.75)
      discountBp: 0,
      finalStudyWork: 4,
      finalStudyCost: 4,
    });
    expect(studyTerms(125, true, balance)).toMatchObject({
      discountBp: 2_500,
      finalStudyWork: 3,
      finalStudyCost: 3,
    });
    expect(studyTerms(0, true, balance)).toMatchObject({ finalStudyCost: 1, finalStudyWork: 3 }); // minimum 1
  });
  it("refuses a missing or out-of-range discount contract", () => {
    expect(() => checkStudyBalance(undefined)).toThrow(StudyContractError);
    expect(() => checkStudyBalance({ ...balance, derivedDiscountBp: 1_499 })).toThrow(
      /derivedDiscountBp/,
    );
    expect(() => checkStudyBalance({ ...balance, derivedDiscountBp: 3_501 })).toThrow(
      /derivedDiscountBp/,
    );
    expect(checkStudyBalance({ ...balance, derivedDiscountBp: 1_500 }).derivedDiscountBp).toBe(
      1_500,
    );
    expect(() => studyTerms(-1, false, balance)).toThrow(RangeError);
  });
});
