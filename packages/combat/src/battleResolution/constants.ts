import { BluewaveError } from "@bluewave/contracts";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";
import { DEFAULT_MAX_BATTLE_MINUTES } from "./battleEnd.js";
import { KNOTS_TO_UM_S, SPEED_BP_SCALE } from "../movement/constants.js";
import { ARMOR_QUALITY_FAMILIES } from "../damage/armorModel.js";

export const battleAutoResolutionPolicyId = "battle_auto_resolution_v1" as const;

export const BATTLE_AUTO_RESOLUTION_RULESET_VERSION = "battle_auto_resolution_ruleset_v1" as const;
export const BATTLE_AUTO_RESOLUTION_FORMULA_VERSION = "battle_auto_resolution_formula_v1" as const;

export const AUTO_RESOLUTION_MAX_MINUTES = DEFAULT_MAX_BATTLE_MINUTES;

export const DEFAULT_AREA_BBOX = {
  minX: 0,
  minY: 0,
  maxX: 20_000_000_000,
  maxY: 10_000_000_000,
} as const;

export const AUTO_RESOLUTION_BATTLE_DATE_DAY = 15 as const;
export const AUTO_RESOLUTION_BATTLE_START_TIME = "06:00" as const;
export const AUTO_RESOLUTION_BATTLE_START_MINUTES = 360 as const;

export const AUTO_TORPEDO_CREW_QUALITY_BP = 7_000;

export const GUNNERY_BASE_RELOAD_MS = 60_000 as const;
export const GUNNERY_ACCURACY_BASE_BP = 4_000 as const;

export const BATTLE_ENGAGEMENT_RANGE_UM = 2_000_000_000 as const;
export const BATTLE_ENGAGEMENT_BAND_UM = 1_000_000_000 as const;
export const RANGE_CONTEST_OWN_MANEUVER_BP = 4_100 as const;

export const WITHDRAWAL_STRENGTH_THRESHOLD_BP = 2_000 as const;

export function designedSpeedBpKnots(designedSpeedUms: number): number {
  return Math.floor((designedSpeedUms * SPEED_BP_SCALE) / KNOTS_TO_UM_S);
}

export const SHELL_MUZZLE_VELOCITY_MS = 762 as const;
export const SHELL_IMPACT_ANGLE_DEG = 0 as const;
export const ARMOR_QUALITY_FAMILY = "HARVEY" as const;

export const HIT_STRUCTURAL_DAMAGE_BASE = 2_000 as const;

export const HIT_DAMAGE_OUTCOME_BP = {
  NO_EFFECT: 0,
  DUD: 0,
  SPLINTER_EFFECT: 2_500,
  PARTIAL_PENETRATION: 5_000,
  FULL_PENETRATION: 10_000,
  PASS_THROUGH: 4_000,
  CRITICAL_PENETRATION: 20_000,
} as const;

export const FLOAT_LOSS_RATIO_BP = 5_000 as const;

export const PARTIAL_BREACH_FLOAT_LOSS_RATIO_BP = 1_500 as const;

export const PARTIAL_BREACH_MIN_RATIO_BP = 6_500 as const;

export function assertShippedArmorQualityFamily(family: string): void {
  if (!(ARMOR_QUALITY_FAMILIES as readonly string[]).includes(family)) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      family,
      reason: "armor quality family must be a shipped armor_v1 family",
    });
  }
}

export const AUTO_ZONES = ["BELT", "DECK", "SUPERSTRUCTURE", "MAGAZINE"] as const;
export type AutoResolutionZoneId = (typeof AUTO_ZONES)[number];

export const ZONE_THICKNESS_BP: Record<AutoResolutionZoneId, number> = {
  BELT: 10_000,
  DECK: 5_000,
  SUPERSTRUCTURE: 2_500,
  MAGAZINE: 8_000,
} as const;

export const ZONE_HIT_WEIGHT_BP: Record<AutoResolutionZoneId, number> = {
  BELT: 4_000,
  DECK: 3_000,
  SUPERSTRUCTURE: 2_700,
  MAGAZINE: 300,
} as const;

export const ZONE_CRITICAL: Record<AutoResolutionZoneId, boolean> = {
  BELT: false,
  DECK: false,
  SUPERSTRUCTURE: false,
  MAGAZINE: true,
} as const;

export interface AutoResolutionZone {
  id: string;
  zoneType: string;
  thicknessUm: number;
  critical: boolean;
}

export function autoZonesForBelt(beltArmorUm: number): readonly AutoResolutionZone[] {
  return AUTO_ZONES.map((id) => ({
    id,
    zoneType: id as AutoResolutionZoneId,
    thicknessUm: Math.floor((beltArmorUm * ZONE_THICKNESS_BP[id]) / 10_000),
    critical: ZONE_CRITICAL[id],
  }));
}

export const AUTO_RESOLUTION_COMPARTMENTS = [
  "COMP-BELT-1",
  "COMP-DECK-1",
  "COMP-MAGAZINE-1",
] as const;
export const AUTO_RESOLUTION_COMPONENTS = [
  "TURRET-1",
  "ENGINE-1",
  "RUDDER-1",
  "FIRE_DIRECTOR-1",
  "CONNING-1",
  "AA-1",
] as const;

export const STRUCTURE_UNIT = 100_000 as const;
export const FLOAT_UNIT = 400_000 as const;
export const STABILITY_INITIAL_BP = 8_000 as const;

export interface BattleAutoResolutionContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  defaultMaxBattleMinutes: number;
  baseReloadMs: number;
  accuracyBaseBp: number;
  shellMuzzleVelocityMs: number;
  armorQualityFamily: string;
  structureUnit: number;
  floatUnit: number;
  zones: readonly string[];
  engagementRangeUm: number;
  engagementBandUm: number;
  rangeContestOwnManeuverBp: number;
  withdrawalStrengthThresholdBp: number;
}

export const SHIPPED_BATTLE_AUTO_RESOLUTION_V1: BattleAutoResolutionContract = {
  policyId: battleAutoResolutionPolicyId,
  rulesetVersion: BATTLE_AUTO_RESOLUTION_RULESET_VERSION,
  formulaVersion: BATTLE_AUTO_RESOLUTION_FORMULA_VERSION,
  defaultMaxBattleMinutes: AUTO_RESOLUTION_MAX_MINUTES,
  baseReloadMs: GUNNERY_BASE_RELOAD_MS,
  accuracyBaseBp: GUNNERY_ACCURACY_BASE_BP,
  shellMuzzleVelocityMs: SHELL_MUZZLE_VELOCITY_MS,
  armorQualityFamily: ARMOR_QUALITY_FAMILY,
  structureUnit: STRUCTURE_UNIT,
  floatUnit: FLOAT_UNIT,
  zones: AUTO_ZONES,
  engagementRangeUm: BATTLE_ENGAGEMENT_RANGE_UM,
  engagementBandUm: BATTLE_ENGAGEMENT_BAND_UM,
  rangeContestOwnManeuverBp: RANGE_CONTEST_OWN_MANEUVER_BP,
  withdrawalStrengthThresholdBp: WITHDRAWAL_STRENGTH_THRESHOLD_BP,
};

export function throwContractMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
    code: BATTLE_AUTO_RESOLUTION_FAILED,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function validateBattleAutoResolutionContract(
  c: Partial<BattleAutoResolutionContract> | null | undefined,
): asserts c is BattleAutoResolutionContract {
  if (!c) throwContractMismatch(c, "battle_auto_resolution_v1 missing contract");
  if (c.policyId !== battleAutoResolutionPolicyId)
    throwContractMismatch(c, "battle_auto_resolution_v1 expectant policy id");
  if (
    c.rulesetVersion !== BATTLE_AUTO_RESOLUTION_RULESET_VERSION ||
    c.formulaVersion !== BATTLE_AUTO_RESOLUTION_FORMULA_VERSION
  )
    throwContractMismatch(c, "battle_auto_resolution_v1 ruleset/formula versions");
  if (c.defaultMaxBattleMinutes !== AUTO_RESOLUTION_MAX_MINUTES)
    throwContractMismatch(c, "battle_auto_resolution_v1 default max battle minutes");
  if (c.baseReloadMs !== GUNNERY_BASE_RELOAD_MS)
    throwContractMismatch(c, "battle_auto_resolution_v1 base reload ms");
  if (c.accuracyBaseBp !== GUNNERY_ACCURACY_BASE_BP)
    throwContractMismatch(c, "battle_auto_resolution_v1 accuracy base bp");
  if (c.shellMuzzleVelocityMs !== SHELL_MUZZLE_VELOCITY_MS)
    throwContractMismatch(c, "battle_auto_resolution_v1 shell muzzle velocity");
  if (c.armorQualityFamily !== ARMOR_QUALITY_FAMILY)
    throwContractMismatch(c, "battle_auto_resolution_v1 armor quality family");
  if (c.structureUnit !== STRUCTURE_UNIT || c.floatUnit !== FLOAT_UNIT)
    throwContractMismatch(c, "battle_auto_resolution_v1 structural/flotation units");
  if (!c.zones || !arrayEquals(c.zones, AUTO_ZONES))
    throwContractMismatch(c, "battle_auto_resolution_v1 canonical zone set");
  if (c.engagementRangeUm !== BATTLE_ENGAGEMENT_RANGE_UM)
    throwContractMismatch(c, "battle_auto_resolution_v1 engagement range");
  if (c.engagementBandUm !== BATTLE_ENGAGEMENT_BAND_UM)
    throwContractMismatch(c, "battle_auto_resolution_v1 engagement band");
  if (c.rangeContestOwnManeuverBp !== RANGE_CONTEST_OWN_MANEUVER_BP)
    throwContractMismatch(c, "battle_auto_resolution_v1 range-contest own manoeuvre");
  if (c.withdrawalStrengthThresholdBp !== WITHDRAWAL_STRENGTH_THRESHOLD_BP)
    throwContractMismatch(c, "battle_auto_resolution_v1 withdrawal strength threshold");
}
