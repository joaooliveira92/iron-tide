import type { CompiledDesign, DesignDraft } from "./compile.js";
import type { PropulsionPlant } from "./machinery.js";
import { designInvariant } from "./errors.js";

export interface StudyBalance {
  readonly costBp: number;
  readonly baseWorkMonths: number;
  readonly derivedDiscountBp: number;
  readonly minFinalWork: number;
  readonly minFinalCost: number;
}

export class StudyContractError extends Error {
  readonly _tag = "StudyContractError";
  constructor(
    readonly code: "DERIVED_DESIGN_DISCOUNT_CONTRACT_MISSING",
    message: string,
  ) {
    super(message);
  }
}

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

export function studyTerms(designCostUnits: number, derived: boolean, b: StudyBalance): StudyTerms {
  if (!Number.isSafeInteger(designCostUnits) || designCostUnits < 0)
    throw designInvariant(`design cost must be a non-negative integer, got ${designCostUnits}`);
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

export type HullCategory =
  | "SURFACE_COMBATANT"
  | "CARRIER"
  | "SUBMARINE"
  | "AUXILIARY"
  | "SMALL_CRAFT";

export const VERTICAL_ZONES = [
  "BELT_MAIN",
  "BELT_UPPER",
  "BELT_ENDS",
  "TURRET",
  "CONNING_TOWER",
] as const;
export const HORIZONTAL_ZONES = ["DECK_MAIN", "DECK_SLOPE"] as const;

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
  readonly secondaryDualPurpose: boolean;
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
  readonly derived: boolean;
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

export function assessSimilarity(b: SimilarityProfile, c: SimilarityProfile): SimilarityAssessment {
  const failed: SimilarityCode[] = [];
  const increase = c.displacementKg - b.displacementKg;
  const maxIncrease = Math.max(Math.floor((b.displacementKg * 1_000) / 10_000), 1_000_000);
  if (increase > maxIncrease || c.displacementKg < Math.floor((b.displacementKg * 8_000) / 10_000))
    failed.push("DERIVED_DESIGN_DISPLACEMENT_CHANGED");
  if (
    Math.abs(c.mainCaliberUm - b.mainCaliberUm) > 25_400 ||
    Math.abs(c.mainMounts - b.mainMounts) > 1 ||
    Math.abs(c.mainMaxBarrelsPerMount - b.mainMaxBarrelsPerMount) > 1 ||
    Math.abs(c.mainBarrels - b.mainBarrels) > Math.max(Math.floor(b.mainBarrels / 4), 2)
  )
    failed.push("DERIVED_DESIGN_MAIN_BATTERY_CHANGED");
  if (secondaryChanged(b, c)) failed.push("DERIVED_DESIGN_SECONDARY_BATTERY_CHANGED");
  if (Math.abs(c.speedMilliKnots - b.speedMilliKnots) > 1_000)
    failed.push("DERIVED_DESIGN_SPEED_CHANGED");
  if (zonesChanged(b, c, VERTICAL_ZONES, 25_400))
    failed.push("DERIVED_DESIGN_VERTICAL_ARMOR_CHANGED");
  if (zonesChanged(b, c, HORIZONTAL_ZONES, 12_700))
    failed.push("DERIVED_DESIGN_HORIZONTAL_ARMOR_CHANGED");
  if (b.hullCategory !== c.hullCategory) failed.push("DERIVED_DESIGN_HULL_CATEGORY_CHANGED");
  if (b.fuelType !== c.fuelType || b.hullFormId !== c.hullFormId)
    failed.push("DERIVED_DESIGN_SPECIAL_FEATURE_CHANGED");
  return { derived: failed.length === 0, failed };
}
