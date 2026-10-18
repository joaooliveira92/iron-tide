import type { CompiledDesign, DesignDraft } from "./compile.js";
import type { PropulsionPlant } from "./machinery.js";

/**
 * Design studies (DESIGN-21 sections 3 and 8-18, ADR-0085). A submitted design is approved only after its study is paid
 * for and finished. A design derived from an approved one in the same family (similar under sections 10-16) gets the
 * `derived_design_study_discount_v1` discount; any failed criterion makes it a new family instead, never a rejection.
 */

/** `design_study_v1` and `derived_design_study_discount_v1` (balance.yaml `study:`). */
export interface StudyBalance {
  /** Base study cost as a share of the design's first-ship cost, bp. */
  readonly costBp: number;
  /** Base study work: months of design-office work for a new design. */
  readonly baseWorkMonths: number;
  /** Derived-design discount, bp (DESIGN-21 section 18: shipped 2_500, permitted 1_500..3_500). */
  readonly derivedDiscountBp: number;
  /** Minimum final study work and cost, canonical units (section 18: exactly 1). */
  readonly minFinalWork: number;
  readonly minFinalCost: number;
}

export class StudyContractError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
  readonly _tag = "StudyContractError";
  constructor(
    readonly code: "DERIVED_DESIGN_DISCOUNT_CONTRACT_MISSING",
    message: string,
  ) {
    super(message);
  }
}

/** Throws `DERIVED_DESIGN_DISCOUNT_CONTRACT_MISSING` for a missing or out-of-range field (section 18). */
export function checkStudyBalance(b: Partial<StudyBalance> | undefined | null): StudyBalance {
  const need = (k: keyof StudyBalance, ok: (v: number) => boolean) => {
    const v = b?.[k];
    if (typeof v !== "number" || !Number.isSafeInteger(v) || !ok(v))
      throw new StudyContractError(
        "DERIVED_DESIGN_DISCOUNT_CONTRACT_MISSING",
        `study.${k} is missing or out of range (${String(v)})`,
      );
    return v;
  };
  return {
    costBp: need("costBp", (v) => v > 0 && v <= 10_000),
    baseWorkMonths: need("baseWorkMonths", (v) => v >= 1),
    derivedDiscountBp: need("derivedDiscountBp", (v) => v >= 1_500 && v <= 3_500),
    minFinalWork: need("minFinalWork", (v) => v === 1),
    minFinalCost: need("minFinalCost", (v) => v === 1),
  };
}

export interface StudyTerms {
  readonly baseStudyWork: number;
  readonly baseStudyCost: number;
  readonly discountBp: number;
  readonly finalStudyWork: number;
  readonly finalStudyCost: number;
}

const ceilDiv = (a: number, b: number) => Math.floor((a + b - 1) / b);

/**
 * Study work (months) and cost (treasury units) for a design whose first ship costs `designCostUnits`. Section 18:
 * `final = ceiling(base * (10_000 - discountBp) / 10_000)`, never below the minimums. Integer and exact.
 */
export function studyTerms(designCostUnits: number, derived: boolean, b: StudyBalance): StudyTerms {
  if (!Number.isSafeInteger(designCostUnits) || designCostUnits < 0)
    throw new RangeError(`design cost must be a non-negative integer, got ${designCostUnits}`);
  const baseStudyWork = b.baseWorkMonths;
  const baseStudyCost = Math.max(b.minFinalCost, ceilDiv(designCostUnits * b.costBp, 10_000));
  const discountBp = derived ? b.derivedDiscountBp : 0;
  const keep = 10_000 - discountBp;
  return {
    baseStudyWork,
    baseStudyCost,
    discountBp,
    finalStudyWork: Math.max(b.minFinalWork, ceilDiv(baseStudyWork * keep, 10_000)),
    finalStudyCost: Math.max(b.minFinalCost, ceilDiv(baseStudyCost * keep, 10_000)),
  };
}

// ---- Similarity (sections 9-17) ----------------------------------------------------------------

/** The broad hull categories of section 8. Every EARLY-band hull is a surface combatant. */
export type HullCategory =
  | "SURFACE_COMBATANT"
  | "CARRIER"
  | "SUBMARINE"
  | "AUXILIARY"
  | "SMALL_CRAFT";

/** Vertical and horizontal armour zones (sections 14 and 15) among this package's armour regions. */
export const VERTICAL_ZONES = [
  "BELT_MAIN",
  "BELT_UPPER",
  "BELT_ENDS",
  "TURRET",
  "CONNING_TOWER",
] as const;
export const HORIZONTAL_ZONES = ["DECK_MAIN", "DECK_SLOPE"] as const;

/** What similarity compares, read from one compiled design. Integer canonical units only. */
export interface SimilarityProfile {
  readonly hullCategory: HullCategory;
  readonly hullFormId: string;
  readonly fuelType: string;
  readonly displacementKg: number;
  readonly speedMilliKnots: number;
  readonly mainCaliberUm: number;
  readonly mainMounts: number;
  readonly mainMaxBarrelsPerMount: number;
  readonly mainBarrels: number;
  readonly secondaryMaxCaliberUm: number;
  readonly secondaryBarrels: number;
  readonly secondaryWeightKg: number;
  /** Whether any secondary mount is dual-purpose (a different technology family from single-purpose guns). */
  readonly secondaryDualPurpose: boolean;
  /** Thickness per zone, micrometres; a zone that is absent is 0. */
  readonly armourUm: Readonly<Record<string, number>>;
}

export function similarityProfile(
  compiled: CompiledDesign,
  draft: DesignDraft,
  plants: readonly PropulsionPlant[],
): SimilarityProfile {
  const main = compiled.components.filter((c) => c.category === "MAIN_GUN");
  const secondary = compiled.components.filter(
    (c) => c.category === "SECONDARY_GUN" || c.category === "DUAL_PURPOSE_GUN",
  );
  const barrels = (c: (typeof main)[number]) => c.params.barrels ?? 1;
  const caliber = (c: (typeof main)[number]) => c.attr.caliberUm ?? 0;
  const armourUm: Record<string, number> = {};
  for (const r of draft.armour.regions)
    armourUm[r.region] = Math.max(armourUm[r.region] ?? 0, r.thicknessUm);
  return {
    hullCategory: "SURFACE_COMBATANT",
    hullFormId: draft.hull.hullFormId,
    fuelType: plants.find((p) => p.id === draft.machinery.plantId)?.fuelType ?? "COAL",
    displacementKg: compiled.totalKg,
    speedMilliKnots: compiled.machinery?.maxSpeedMilliKnots ?? 0,
    mainCaliberUm: main.reduce((m, c) => Math.max(m, caliber(c)), 0),
    mainMounts: main.length,
    mainMaxBarrelsPerMount: main.reduce((m, c) => Math.max(m, barrels(c)), 0),
    mainBarrels: main.reduce((s, c) => s + barrels(c), 0),
    secondaryMaxCaliberUm: secondary.reduce((m, c) => Math.max(m, caliber(c)), 0),
    secondaryBarrels: secondary.reduce((s, c) => s + barrels(c), 0),
    secondaryWeightKg: secondary.reduce((s, c) => s + c.weightKg, 0),
    secondaryDualPurpose: secondary.some((c) => c.category === "DUAL_PURPOSE_GUN"),
    armourUm,
  };
}

export type SimilarityCode =
  | "DERIVED_DESIGN_DISPLACEMENT_CHANGED"
  | "DERIVED_DESIGN_MAIN_BATTERY_CHANGED"
  | "DERIVED_DESIGN_SECONDARY_BATTERY_CHANGED"
  | "DERIVED_DESIGN_SPEED_CHANGED"
  | "DERIVED_DESIGN_VERTICAL_ARMOR_CHANGED"
  | "DERIVED_DESIGN_HORIZONTAL_ARMOR_CHANGED"
  | "DERIVED_DESIGN_HULL_CATEGORY_CHANGED"
  | "DERIVED_DESIGN_SPECIAL_FEATURE_CHANGED";

export interface SimilarityAssessment {
  /** True only when every criterion holds (section 9). */
  readonly derived: boolean;
  /** Failed criteria, in the fixed order of sections 10-16. */
  readonly failed: readonly SimilarityCode[];
}

const SIX_INCH_UM = 152_400;
const FIVE_INCH_UM = 127_000;

function secondaryChanged(b: SimilarityProfile, c: SimilarityProfile): boolean {
  if (b.secondaryBarrels === 0)
    return c.secondaryBarrels > 4 || c.secondaryMaxCaliberUm > FIVE_INCH_UM;
  return (
    Math.abs(c.secondaryMaxCaliberUm - b.secondaryMaxCaliberUm) > 12_700 ||
    Math.abs(c.secondaryBarrels - b.secondaryBarrels) >
      Math.max(Math.floor((b.secondaryBarrels * 33) / 100), 4) ||
    Math.abs(c.secondaryWeightKg - b.secondaryWeightKg) * 4 > b.secondaryWeightKg ||
    b.secondaryDualPurpose !== c.secondaryDualPurpose ||
    b.secondaryMaxCaliberUm > SIX_INCH_UM !== c.secondaryMaxCaliberUm > SIX_INCH_UM
  );
}

function zonesChanged(
  b: SimilarityProfile,
  c: SimilarityProfile,
  zones: readonly string[],
  limitUm: number,
): boolean {
  return zones.some((z) => Math.abs((c.armourUm[z] ?? 0) - (b.armourUm[z] ?? 0)) > limitUm);
}

/**
 * Sections 10-16 on two profiles. Every threshold is inclusive (equality stays similar) and exact. Mount technology
 * family, layout topology, aviation, missiles and treaty category have no EARLY-band mechanics and cannot differ here.
 */
export function assessSimilarity(b: SimilarityProfile, c: SimilarityProfile): SimilarityAssessment {
  const failed: SimilarityCode[] = [];
  const increase = c.displacementKg - b.displacementKg;
  const maxIncrease = Math.max(Math.floor((b.displacementKg * 1_000) / 10_000), 1_000_000);
  // Section 10; a fall of more than 20 % breaks the hull-form criterion, reported with the displacement.
  if (increase > maxIncrease || c.displacementKg < Math.floor((b.displacementKg * 8_000) / 10_000))
    failed.push("DERIVED_DESIGN_DISPLACEMENT_CHANGED");
  // Section 11.
  if (
    Math.abs(c.mainCaliberUm - b.mainCaliberUm) > 25_400 ||
    Math.abs(c.mainMounts - b.mainMounts) > 1 ||
    Math.abs(c.mainMaxBarrelsPerMount - b.mainMaxBarrelsPerMount) > 1 ||
    Math.abs(c.mainBarrels - b.mainBarrels) > Math.max(Math.floor(b.mainBarrels / 4), 2)
  )
    failed.push("DERIVED_DESIGN_MAIN_BATTERY_CHANGED");
  // Section 12.
  if (secondaryChanged(b, c)) failed.push("DERIVED_DESIGN_SECONDARY_BATTERY_CHANGED");
  // Section 13: one knot is 514_444 um/s; designed speed is held in milli-knots, so one knot is 1_000.
  if (Math.abs(c.speedMilliKnots - b.speedMilliKnots) > 1_000)
    failed.push("DERIVED_DESIGN_SPEED_CHANGED");
  // Sections 14-15.
  if (zonesChanged(b, c, VERTICAL_ZONES, 25_400))
    failed.push("DERIVED_DESIGN_VERTICAL_ARMOR_CHANGED");
  if (zonesChanged(b, c, HORIZONTAL_ZONES, 12_700))
    failed.push("DERIVED_DESIGN_HORIZONTAL_ARMOR_CHANGED");
  // Section 16.
  if (b.hullCategory !== c.hullCategory) failed.push("DERIVED_DESIGN_HULL_CATEGORY_CHANGED");
  if (b.fuelType !== c.fuelType || b.hullFormId !== c.hullFormId)
    failed.push("DERIVED_DESIGN_SPECIAL_FEATURE_CHANGED");
  return { derived: failed.length === 0, failed };
}
