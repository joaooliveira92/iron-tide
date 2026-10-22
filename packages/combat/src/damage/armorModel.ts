import { BluewaveError } from "@bluewave/contracts";
import {
  ARMOR_ZONE_MAXIMUM_MISSING,
  ARMOR_THICKNESS_LIMIT_EXCEEDED,
  ARMOR_QUALITY_MULTIPLIER_MISSING,
  DAMAGE_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

export const armorPolicyId = "armor_v1" as const;
export const ARMOR_RULESET_VERSION = "armor_ruleset_v1" as const;
export const ARMOR_FORMULA_VERSION = "armor_formula_v1" as const;

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
  SPLINTER_DECK: 102_000,
  TORPEDO_BULKHEAD: ZONE_MAXIMUM_BELT_UM,
};

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

export const THICK_ARMOR_THRESHOLD_UM = 304_800 as const;
export const THICK_ARMOR_EXCESS_BP = 7_500 as const;

export function manufacturingEffectiveThickness(actualUm: number): number {
  const thinPortion = Math.min(actualUm, THICK_ARMOR_THRESHOLD_UM);
  const excess = Math.max(0, actualUm - THICK_ARMOR_THRESHOLD_UM);
  return thinPortion + Math.floor((excess * THICK_ARMOR_EXCESS_BP) / 10_000);
}

export const ARMOR_QUALITY_FAMILIES = [
  "IRON",
  "COMPOUND",
  "HARVEY",
  "KRUPP_KC",
  "POST_KC",
] as const;
export type ArmorQualityFamily = (typeof ARMOR_QUALITY_FAMILIES)[number];

export const ARMOR_QUALITY_MULTIPLIERS_BP: Record<ArmorQualityFamily, number> = {
  IRON: 8_000,
  COMPOUND: 9_000,
  HARVEY: 10_000,
  KRUPP_KC: 10_500,
  POST_KC: 11_000,
};

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

export function qualityAdjustedThickness(
  effectiveThicknessUm: number,
  qualityMultiplierBp: number,
): number {
  return Math.floor((effectiveThicknessUm * qualityMultiplierBp) / 10_000);
}

export function obliquityFactorBp(impactAngleDeg: number, armorSlopeDeg: number): number {
  const netAngle = Math.max(0, impactAngleDeg - armorSlopeDeg);
  const cosVal = Math.cos((netAngle * Math.PI) / 180);
  const raw = Math.floor(cosVal * 10_000);
  return Math.max(0, Math.min(10_000, raw));
}

export const SPLINTER_THRESHOLD_UM = 50_800 as const;

export const SPLINTER_CLASSES = ["LIGHT", "MEDIUM", "HEAVY", "EXTREME"] as const;
export type SplinterClass = (typeof SPLINTER_CLASSES)[number];

export function splinterProtectionLevel(armorThicknessUm: number): SplinterClass | null {
  if (armorThicknessUm >= SPLINTER_THRESHOLD_UM) {
    if (armorThicknessUm >= 102_000) {
      return "HEAVY";
    }
    return "MEDIUM";
  }
  return null;
}

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

export function determinePenetrationOutcome(
  penetrationCapabilityUm: number,
  effectiveResistanceUm: number,
  impactAngleDeg: number,
  isCriticalZone: boolean,
): PenetrationOutcome {
  if (impactAngleDeg > 70) {
    return "DUD";
  }

  if (penetrationCapabilityUm > effectiveResistanceUm * 3) {
    return "PASS_THROUGH";
  }

  if (penetrationCapabilityUm >= effectiveResistanceUm) {
    if (isCriticalZone) {
      return "CRITICAL_PENETRATION";
    }
    return "FULL_PENETRATION";
  }

  if (penetrationCapabilityUm >= effectiveResistanceUm * 0.5) {
    return "PARTIAL_PENETRATION";
  }

  if (penetrationCapabilityUm >= effectiveResistanceUm * 0.25) {
    return "SPLINTER_EFFECT";
  }

  return "NO_EFFECT";
}

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
