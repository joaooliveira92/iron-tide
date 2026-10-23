import { BluewaveError } from "@bluewave/contracts";
import {
  ARMOR_QUALITY_FAMILY,
  AUTO_ZONES,
  BATTLE_AUTO_RESOLUTION_FAILED,
  FLOAT_UNIT,
  SHELL_MUZZLE_VELOCITY_MS,
  STRUCTURE_UNIT,
} from "../damage/minuteDamageConstants.js";
import {
  AUTO_RESOLUTION_BATTLE_DATE_DAY,
  AUTO_RESOLUTION_BATTLE_START_MINUTES,
  AUTO_RESOLUTION_BATTLE_START_TIME,
  DEFAULT_AREA_BBOX,
} from "../weather/auto-resolution-battle-defaults.js";
import { DEFAULT_MAX_BATTLE_MINUTES } from "./battleEnd.js";
import { KNOTS_TO_UM_S, SPEED_BP_SCALE } from "../movement/constants.js";

export {
  SHELL_MUZZLE_VELOCITY_MS,
  SHELL_IMPACT_ANGLE_DEG,
  ARMOR_QUALITY_FAMILY,
  HIT_STRUCTURAL_DAMAGE_BASE,
  HIT_DAMAGE_OUTCOME_BP,
  FLOAT_LOSS_RATIO_BP,
  PARTIAL_BREACH_FLOAT_LOSS_RATIO_BP,
  PARTIAL_BREACH_MIN_RATIO_BP,
  assertShippedArmorQualityFamily,
  AUTO_ZONES,
  ZONE_THICKNESS_BP,
  ZONE_HIT_WEIGHT_BP,
  ZONE_CRITICAL,
  autoZonesForBelt,
  AUTO_RESOLUTION_COMPARTMENTS,
  AUTO_RESOLUTION_COMPONENTS,
  STRUCTURE_UNIT,
  FLOAT_UNIT,
  STABILITY_INITIAL_BP,
  type AutoResolutionZoneId,
  type AutoResolutionZone,
} from "../damage/minuteDamageConstants.js";
export {
  AUTO_RESOLUTION_BATTLE_DATE_DAY,
  AUTO_RESOLUTION_BATTLE_START_MINUTES,
  AUTO_RESOLUTION_BATTLE_START_TIME,
  DEFAULT_AREA_BBOX,
};

export const battleAutoResolutionPolicyId = "battle_auto_resolution_v1" as const;

export const BATTLE_AUTO_RESOLUTION_RULESET_VERSION = "battle_auto_resolution_ruleset_v1" as const;
export const BATTLE_AUTO_RESOLUTION_FORMULA_VERSION = "battle_auto_resolution_formula_v1" as const;

export const AUTO_RESOLUTION_MAX_MINUTES = DEFAULT_MAX_BATTLE_MINUTES;

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
