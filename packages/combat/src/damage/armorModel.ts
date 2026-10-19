// DESIGN-39 §§16-24 armor model: pure functions + armor_v1 constants.
// Zone maxima, thick-armor manufacturing, quality adjustment, impact geometry,
// splinter protection, and 7 penetration outcomes. All arithmetic is integer
// fixed-point (DESIGN-07) in µm and basis points. Pure/deterministic: no ambient
// I/O/clock/random. Grounded in docs/research/b4-m2-armor-damage.md.
import { BluewaveError } from "@bluewave/contracts";
import {
  ARMOR_ZONE_MAXIMUM_MISSING,
  ARMOR_THICKNESS_LIMIT_EXCEEDED,
  ARMOR_QUALITY_MULTIPLIER_MISSING,
  DAMAGE_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

// Version identifiers
export const armorPolicyId = "armor_v1" as const;
export const ARMOR_RULESET_VERSION = "armor_ruleset_v1" as const;
export const ARMOR_FORMULA_VERSION = "armor_formula_v1" as const;

// §17 — Canonical armor zone types
export const ARMOR_ZONE_TYPES = [
  "BELT",
  "TURRET_FACE",
  "BARBETTE",
  "CONNING_TOWER",
  "DECK",
  "CASEMATE",
  "BULKHEAD",
  "SUPERSTRUCTURE",
  "SPLINTER_DECK",
  "TORPEDO_BULKHEAD",
] as const;
export type ArmorZoneType = (typeof ARMOR_ZONE_TYPES)[number];

// §17 — Zone maxima (µm). belt ≤ 508_000 (20 in);
// turret-face / barbette / conning-tower ≤ 660_400 (26 in).
// Other zones declare a max; unknown zone type → ARMOR_ZONE_MAXIMUM_MISSING.
// Equality legal; above-max → ARMOR_THICKNESS_LIMIT_EXCEEDED.
export const ZONE_MAXIMUM_BELT_UM = 508_000 as const;
export const ZONE_MAXIMUM_TURRET_FACE_BARBETTE_CONNING_TOWER_UM = 660_400 as const;

export const ZONE_MAXIMA_UM: Record<string, number> = {
  BELT: ZONE_MAXIMUM_BELT_UM,
  TURRET_FACE: ZONE_MAXIMUM_TURRET_FACE_BARBETTE_CONNING_TOWER_UM,
  BARBETTE: ZONE_MAXIMUM_TURRET_FACE_BARBETTE_CONNING_TOWER_UM,
  CONNING_TOWER: ZONE_MAXIMUM_TURRET_FACE_BARBETTE_CONNING_TOWER_UM,
  DECK: ZONE_MAXIMUM_BELT_UM,
  CASEMATE: ZONE_MAXIMUM_BELT_UM,
  BULKHEAD: ZONE_MAXIMUM_BELT_UM,
  SUPERSTRUCTURE: ZONE_MAXIMUM_BELT_UM,
  SPLINTER_DECK: 102_000, // ~4 inches — typical splinter-deck maximum
  TORPEDO_BULKHEAD: ZONE_MAXIMUM_BELT_UM,
};

/**
 * Armour zone a component id (`<TYPE>-<n>`) is exposed through, or undefined for internals.
 * The design's single `TURRET` region (turret + barbette, ADR-0232) reaches combat as `TURRET_FACE`: a `BARBETTE-*`
 * component is folded into it, so design data never produces a separate barbette zone. The `BARBETTE` zone type and
 * its maximum stay in the armour contract unchanged (no rebalance); nothing emits it.
 */
export function inferArmorZoneType(id: string): ArmorZoneType | undefined {
  switch (id.split("-")[0]) {
    case "TURRET":
    case "BARBETTE":
      return "TURRET_FACE";
    case "CONNING":
      return "CONNING_TOWER";
    case "AA":
    case "DIRECTOR":
    case "RANGEFINDER":
      return "SUPERSTRUCTURE";
    default:
      return undefined;
  }
}

/**
 * Retrieve the authoritative maximum thickness (µm) for a given zone type.
 * @throws BluewaveError(ARMOR_ZONE_MAXIMUM_MISSING) if the zone type is unknown.
 */
export function getZoneMaximumUm(zoneType: string): number {
  const max = ZONE_MAXIMA_UM[zoneType];
  if (max === undefined) {
    throw new BluewaveError(ARMOR_ZONE_MAXIMUM_MISSING, {
      code: ARMOR_ZONE_MAXIMUM_MISSING,
      zoneType,
      reason: `no shipped maximum for armor zone type "${zoneType}"`,
    });
  }
  return max;
}

/**
 * Validate that a armor thickness does not exceed the zone's maximum.
 * @throws BluewaveError(ARMOR_ZONE_MAXIMUM_MISSING) if zone type unknown.
 * @throws BluewaveError(ARMOR_THICKNESS_LIMIT_EXCEEDED) if thickness > max.
 */
export function validateArmorThickness(zoneType: string, thicknessUm: number): void {
  const max = getZoneMaximumUm(zoneType);
  if (thicknessUm > max) {
    throw new BluewaveError(ARMOR_THICKNESS_LIMIT_EXCEEDED, {
      code: ARMOR_THICKNESS_LIMIT_EXCEEDED,
      zoneType,
      thicknessUm,
      maxUm: max,
      reason: `armor thickness ${thicknessUm}µm exceeds zone ${zoneType} maximum ${max}µm`,
    });
  }
}

// §19 — Thick-armor manufacturing
// Threshold: 304 800 µm (12 in). Below threshold: full thickness.
// Above threshold: excess effectiveness discounted at 7 500 bp.
// Formula: effectiveThickness = thinPortion + floor(excess × 7_500 / 10_000)
export const THICK_ARMOR_THRESHOLD_UM = 304_800 as const;
export const THICK_ARMOR_EXCESS_BP = 7_500 as const;

/**
 * Compute the manufacturing-effective thickness after thick-armor discount.
 * @param actualUm - The design thickness in micrometres.
 * @returns Effective thickness after manufacturing discount (integer µm).
 */
export function manufacturingEffectiveThickness(actualUm: number): number {
  const thinPortion = Math.min(actualUm, THICK_ARMOR_THRESHOLD_UM);
  const excess = Math.max(0, actualUm - THICK_ARMOR_THRESHOLD_UM);
  return thinPortion + Math.floor((excess * THICK_ARMOR_EXCESS_BP) / 10_000);
}

// §20 — Armor quality multiplier families
// Five shipped families with basis-point multipliers.
export const ARMOR_QUALITY_FAMILIES = [
  "IRON",
  "COMPOUND",
  "HARVEY",
  "KRUPP_KC",
  "POST_KC",
] as const;
export type ArmorQualityFamily = (typeof ARMOR_QUALITY_FAMILIES)[number];

/** Basis-point multipliers keyed by armor quality family. */
export const ARMOR_QUALITY_MULTIPLIERS_BP: Record<ArmorQualityFamily, number> = {
  IRON: 8_000,
  COMPOUND: 9_000,
  HARVEY: 10_000,
  KRUPP_KC: 10_500,
  POST_KC: 11_000,
};

/**
 * Look up the quality multiplier (bp) for a named family.
 * @throws BluewaveError(ARMOR_QUALITY_MULTIPLIER_MISSING) for unknown families.
 */
export function lookupArmorQualityMultiplierBp(family: string): number {
  const validFamilies = ARMOR_QUALITY_FAMILIES as readonly string[];
  if (!validFamilies.includes(family)) {
    throw new BluewaveError(ARMOR_QUALITY_MULTIPLIER_MISSING, {
      code: ARMOR_QUALITY_MULTIPLIER_MISSING,
      family,
      reason: `unknown armor quality family "${family}" — no shipped multiplier`,
    });
  }
  return ARMOR_QUALITY_MULTIPLIERS_BP[family as ArmorQualityFamily];
}

/**
 * Compute the quality-adjusted thickness after applying the family multiplier.
 * Formula: floor(manufacturingEffectiveThickness × qualityMultiplierBp / 10_000)
 * @param effectiveThicknessUm - Thickness after manufacturing (µm).
 * @param qualityMultiplierBp - Quality multiplier in basis points.
 * @returns Quality-adjusted thickness (integer µm).
 */
export function qualityAdjustedThickness(
  effectiveThicknessUm: number,
  qualityMultiplierBp: number,
): number {
  return Math.floor((effectiveThicknessUm * qualityMultiplierBp) / 10_000);
}

// §21 — Impact geometry / obliquity
// Obliquity factor is the cosine ratio normalised by angle difference.
// The factor is expressed in basis points.

/**
 * Compute the obliquity factor from the impact angle and armor slope.
 * Result in basis points, where 10_000 = 0° effective obliquity (normal impact).
 * Formula: floor(cos(netAngle_deg × π / 180) × 10_000)
 * where netAngle = max(0, impactAngleDeg - armorSlopeDeg).
 * @param impactAngleDeg - The shell's impact angle relative to horizontal (0 = flat).
 * @param armorSlopeDeg - The armor plate's slope from vertical (0 = vertical).
 * @returns Obliquity factor in basis points [0, 10_000].
 */
export function obliquityFactorBp(impactAngleDeg: number, armorSlopeDeg: number): number {
  const netAngle = Math.max(0, impactAngleDeg - armorSlopeDeg);
  const cosVal = Math.cos((netAngle * Math.PI) / 180);
  const raw = Math.floor(cosVal * 10_000);
  return Math.max(0, Math.min(10_000, raw));
}

// §22 — Splinter threshold and protection classes

/** Splinter protection threshold: 50 800 µm (2 inches). */
export const SPLINTER_THRESHOLD_UM = 50_800 as const;

/** The four splinter classes (§23). */
export const SPLINTER_CLASSES = ["LIGHT", "MEDIUM", "HEAVY", "EXTREME"] as const;
export type SplinterClass = (typeof SPLINTER_CLASSES)[number];

/**
 * Determine the splinter protection level provided by an armor thickness.
 * - ≥ 50 800 µm (2 in): protects fully against LIGHT and MEDIUM, partially against HEAVY.
 * - < 50 800 µm: no splinter protection.
 *
 * Returns the highest splinter class the armor fully protects against.
 * LIGHT + MEDIUM are fully stopped at 2 in; HEAVY and EXTREME are classed.
 */
export function splinterProtectionLevel(armorThicknessUm: number): SplinterClass | null {
  if (armorThicknessUm >= SPLINTER_THRESHOLD_UM) {
    // 2 inches stops LIGHT and MEDIUM splinters fully.
    // For HEAVY and EXTREME, the threshold is higher; below that we return MEDIUM
    // as the maximum fully-protected class at this thickness.
    // Per §23: 2 in protects fully against LIGHT and MEDIUM.
    // HEAVY requires formula; EXTREME requires formula (≥ ~4 in threshold commonly).
    if (armorThicknessUm >= 102_000) {
      // ~4 inches stops HEAVY splinters; EXTREME requires even more.
      return "HEAVY";
    }
    return "MEDIUM";
  }
  return null; // No splinter protection
}

// §24 — Seven penetration outcomes
export const PENETRATION_OUTCOMES = [
  "NO_EFFECT",
  "SPLINTER_EFFECT",
  "PARTIAL_PENETRATION",
  "FULL_PENETRATION",
  "PASS_THROUGH",
  "DUD",
  "CRITICAL_PENETRATION",
] as const;
export type PenetrationOutcome = (typeof PENETRATION_OUTCOMES)[number];

/**
 * Determine the penetration outcome based on the shell's effective penetration
 * capability vs the armor's effective resistance, plus geometry.
 *
 * Deterministic predicate (no randomness):
 * - DUD: impact angle > 70° relative (ricochet/fuze failure regime)
 * - PASS_THROUGH: penetrationCapability > 3 × effectiveResistance (overpenetration)
 * - CRITICAL_PENETRATION: penetrationCapability >= effectiveResistance
 *     AND the hit is in a critical zone (magazine, conning-tower)
 * - FULL_PENETRATION: penetrationCapability >= effectiveResistance
 * - PARTIAL_PENETRATION: penetrationCapability >= effectiveResistance × 0.5
 * - SPLINTER_EFFECT: penetrationCapability >= effectiveResistance × 0.25
 * - NO_EFFECT: below all thresholds
 *
 * @param penetrationCapabilityUm - Shell's effective penetration at impact (µm).
 * @param effectiveResistanceUm - Armor's effective resistance (µm, after manufacturing + quality + obliquity).
 * @param impactAngleDeg - Impact angle from horizontal (degrees).
 * @param isCriticalZone - Whether the struck zone is critical (magazine, etc.).
 * @returns The deterministic penetration outcome.
 */
export function determinePenetrationOutcome(
  penetrationCapabilityUm: number,
  effectiveResistanceUm: number,
  impactAngleDeg: number,
  isCriticalZone: boolean,
): PenetrationOutcome {
  // Ricochet / dud: very oblique impact
  if (impactAngleDeg > 70) {
    return "DUD";
  }

  // Overpenetration: shell far exceeds armor resistance
  if (penetrationCapabilityUm > effectiveResistanceUm * 3) {
    return "PASS_THROUGH";
  }

  // Full penetration or better
  if (penetrationCapabilityUm >= effectiveResistanceUm) {
    if (isCriticalZone) {
      return "CRITICAL_PENETRATION";
    }
    return "FULL_PENETRATION";
  }

  // Partial penetration: at least 50% of resistance
  if (penetrationCapabilityUm >= effectiveResistanceUm * 0.5) {
    return "PARTIAL_PENETRATION";
  }

  // Splinter effect: at least 25% of resistance
  if (penetrationCapabilityUm >= effectiveResistanceUm * 0.25) {
    return "SPLINTER_EFFECT";
  }

  // No effect
  return "NO_EFFECT";
}

// ArmorContract — ships all authored constant values.
export interface ArmorContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  beltMaximumUm: number;
  turretFaceBarbetteConningTowerMaximumUm: number;
  thickArmorThresholdUm: number;
  thickArmorExcessBp: number;
  splinterThresholdUm: number;
  zoneMaximaUm: Record<string, number>;
  qualityFamilies: readonly ArmorQualityFamily[];
  qualityMultipliersBp: Record<ArmorQualityFamily, number>;
  splinterClasses: readonly SplinterClass[];
  penetrationOutcomes: readonly PenetrationOutcome[];
}

export const SHIPPED_ARMOR_CONTRACT: ArmorContract = {
  policyId: armorPolicyId,
  rulesetVersion: ARMOR_RULESET_VERSION,
  formulaVersion: ARMOR_FORMULA_VERSION,
  beltMaximumUm: ZONE_MAXIMUM_BELT_UM,
  turretFaceBarbetteConningTowerMaximumUm: ZONE_MAXIMUM_TURRET_FACE_BARBETTE_CONNING_TOWER_UM,
  thickArmorThresholdUm: THICK_ARMOR_THRESHOLD_UM,
  thickArmorExcessBp: THICK_ARMOR_EXCESS_BP,
  splinterThresholdUm: SPLINTER_THRESHOLD_UM,
  zoneMaximaUm: ZONE_MAXIMA_UM,
  qualityFamilies: ARMOR_QUALITY_FAMILIES,
  qualityMultipliersBp: ARMOR_QUALITY_MULTIPLIERS_BP,
  splinterClasses: SPLINTER_CLASSES,
  penetrationOutcomes: PENETRATION_OUTCOMES,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(DAMAGE_STATE_INVARIANT_FAILED, {
    code: DAMAGE_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function recordEquals(
  a: Record<string, number>,
  b: Record<string, number>,
  keys: readonly string[],
): boolean {
  return keys.every((k) => a[k] === b[k]);
}

export function validateArmorContract(
  c: Partial<ArmorContract> | null | undefined,
): asserts c is ArmorContract {
  if (!c) throwMismatch(c, "armor_v1 missing contract");
  if (c.policyId !== armorPolicyId) throwMismatch(c, "armor_v1 expectant policy id");
  if (c.rulesetVersion !== ARMOR_RULESET_VERSION || c.formulaVersion !== ARMOR_FORMULA_VERSION)
    throwMismatch(c, "armor_v1 ruleset/formula versions");
  if (c.beltMaximumUm !== ZONE_MAXIMUM_BELT_UM) throwMismatch(c, "armor_v1 belt maximum");
  if (
    c.turretFaceBarbetteConningTowerMaximumUm !== ZONE_MAXIMUM_TURRET_FACE_BARBETTE_CONNING_TOWER_UM
  )
    throwMismatch(c, "armor_v1 turret-face/barbette/conning-tower maximum");
  if (c.thickArmorThresholdUm !== THICK_ARMOR_THRESHOLD_UM)
    throwMismatch(c, "armor_v1 thick-armor threshold");
  if (c.thickArmorExcessBp !== THICK_ARMOR_EXCESS_BP)
    throwMismatch(c, "armor_v1 thick-armor excess bp");
  if (c.splinterThresholdUm !== SPLINTER_THRESHOLD_UM)
    throwMismatch(c, "armor_v1 splinter threshold");

  if (!c.zoneMaximaUm || !recordEquals(c.zoneMaximaUm, ZONE_MAXIMA_UM, Object.keys(ZONE_MAXIMA_UM)))
    throwMismatch(c, "armor_v1 zone maxima set");

  if (!c.qualityFamilies || !arrayEquals(c.qualityFamilies, ARMOR_QUALITY_FAMILIES))
    throwMismatch(c, "armor_v1 quality families");
  if (
    !c.qualityMultipliersBp ||
    !recordEquals(c.qualityMultipliersBp, ARMOR_QUALITY_MULTIPLIERS_BP, ARMOR_QUALITY_FAMILIES)
  )
    throwMismatch(c, "armor_v1 quality multipliers");

  if (!c.splinterClasses || !arrayEquals(c.splinterClasses, SPLINTER_CLASSES))
    throwMismatch(c, "armor_v1 splinter classes");
  if (!c.penetrationOutcomes || !arrayEquals(c.penetrationOutcomes, PENETRATION_OUTCOMES))
    throwMismatch(c, "armor_v1 penetration outcomes");
}
