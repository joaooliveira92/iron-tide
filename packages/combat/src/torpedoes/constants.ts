import { BluewaveError } from "@bluewave/contracts";
import { SUBSTEP_SECONDS, SUBSTEPS_PER_MINUTE } from "../movement/constants.js";
import { TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const torpedoPolicyId = "torpedo_v1" as const;

export const TORPEDO_RULESET_VERSION = "torpedo_ruleset_v1" as const;
export const TORPEDO_FORMULA_VERSION = "torpedo_formula_v1" as const;

export const TORPEDO_BASIS_POINTS_PER_UNIT = 10_000 as const;

export const TORPEDO_SPEED_BP_SCALE = 1_000 as const;
export const TORPEDO_KNOTS_TO_UM_S = 514_444 as const;

export const TORPEDO_RELIABILITY_SCALE = 100_000 as const;

export const TORPEDO_MOUNT_TYPES = [
  "ABOVE_WATER_FIXED",
  "ABOVE_WATER_TRAINABLE",
  "UNDERWATER_FIXED",
  "UNDERWATER_TRAINABLE",
  "SUBMARINE_INTERNAL",
] as const;
export type TorpedoMountType = (typeof TORPEDO_MOUNT_TYPES)[number];

export const TORPEDO_PROPULSION_TYPES = [
  "COMPRESSED_AIR",
  "WET_HEATER",
  "ELECTRIC",
  "OXYGEN",
] as const;
export type TorpedoPropulsionType = (typeof TORPEDO_PROPULSION_TYPES)[number];

export const TORPEDO_WARHEAD_TYPES = [
  "WET_GUNCOTTON",
  "TNT",
  "TORPEX",
  "TPX",
  "HBX",
  "HEXANITE",
  "TYPE_97",
] as const;
export type TorpedoWarheadType = (typeof TORPEDO_WARHEAD_TYPES)[number];

export const TUBE_HIT_HAZARD_POLICIES = ["ORDINARY", "OXYGEN", "ELECTRIC"] as const;
export type TubeHitHazardPolicy = (typeof TUBE_HIT_HAZARD_POLICIES)[number];

export const FIRE_CONTROL_CONNECTION_STATES = ["CONNECTED", "DEGRADED", "DISCONNECTED"] as const;
export type FireControlConnectionState = (typeof FIRE_CONTROL_CONNECTION_STATES)[number];

export const LAUNCHER_DAMAGE_STATES = ["OPERATIONAL", "DAMAGED", "DESTROYED"] as const;
export type LauncherDamageState = (typeof LAUNCHER_DAMAGE_STATES)[number];

export const FLOODING_ISOLATION_STATES = ["INTACT", "DEGRADED", "FAILED"] as const;
export type FloodingIsolationState = (typeof FLOODING_ISOLATION_STATES)[number];

export const EMPTY_TUBE = "EMPTY" as const;
export const NO_FIRE_SOLUTION = "NONE" as const;

export const UNDERWATER_TUBE_MAX_SPEED_KNOTS = 25 as const;
export const UNDERWATER_TUBE_MAX_SPEED_UM_S = 12_861_100 as const;

export const ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS = 30 as const;
export const ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS = 35 as const;

export const TORPEDO_TARGET_CONTACT_MINIMUM_BP = 4_000 as const;

export const TORPEDO_LAUNCH_KINDS = [
  "AUTOMATED",
  "MANUAL_CAPTAIN",
  "AREA_DENIAL",
  "SPREAD",
] as const;
export type TorpedoLaunchKind = (typeof TORPEDO_LAUNCH_KINDS)[number];
export const TORPEDO_SOLUTION_MINIMUM_BP: Record<TorpedoLaunchKind, number> = {
  AUTOMATED: 5_000,
  MANUAL_CAPTAIN: 4_000,
  AREA_DENIAL: 3_000,
  SPREAD: 3_000,
};

export const TORPEDO_MAX_LAUNCH_SEA_STATE = 5 as const;

export const TORPEDO_SOLUTION_FACTOR_KEYS = [
  "range",
  "bearing",
  "targetMotion",
  "ownManeuver",
  "crew",
  "training",
  "seaState",
  "visibility",
  "technology",
  "damage",
] as const;
export type TorpedoSolutionFactorKey = (typeof TORPEDO_SOLUTION_FACTOR_KEYS)[number];
export const NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP = 10_000 as const;
export const TORPEDO_SOLUTION_FINAL_MIN_BP = 0 as const;
export const TORPEDO_SOLUTION_FINAL_MAX_BP = 10_000 as const;
export const TORPEDO_SOLUTION_SCALE_EXPONENT = 10 as const;
export const TORPEDO_SOLUTION_ROUNDING = "floor" as const;
export const TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP = 7_500 as const;

export const TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M = 1_000 as const;
export const TORPEDO_DANGER_SECTOR_RAD_TO_MDEG = 57_296 as const;
export const TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP = 4_000 as const;
export const UNIDENTIFIED_CONTACT_IDENTITY = "UNIDENTIFIED" as const;

export const TORPEDO_MISSION_OBJECTIVES = [
  "ATTACK",
  "DEFENSE",
  "AREA_DENIAL",
  "BREAKTHROUGH",
] as const;
export type TorpedoMissionObjective = (typeof TORPEDO_MISSION_OBJECTIVES)[number];
export const TORPEDO_WITHDRAWAL_STATES = ["NORMAL", "WITHDRAWING"] as const;
export type TorpedoWithdrawalState = (typeof TORPEDO_WITHDRAWAL_STATES)[number];
export const TORPEDO_SALVO_BASE_TUBES: Record<TorpedoMissionObjective, number> = {
  ATTACK: 2,
  DEFENSE: 1,
  AREA_DENIAL: 4,
  BREAKTHROUGH: 3,
};
export const TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES: Record<TorpedoWithdrawalState, number> = {
  NORMAL: 0,
  WITHDRAWING: 1,
};
export const TORPEDO_SALVO_FACTOR_KEYS = [
  "targetCombatValue",
  "targetSize",
  "rangePressure",
  "solutionQualityDeficit",
  "ammoScarcity",
  "friendlyCoveragePressure",
  "overkill",
] as const;
export type TorpedoSalvoFactorKey = (typeof TORPEDO_SALVO_FACTOR_KEYS)[number];
export const TORPEDO_SALVO_FACTOR_WEIGHTS_BP: Record<TorpedoSalvoFactorKey, number> = {
  targetCombatValue: 1_500,
  targetSize: 500,
  rangePressure: 1_000,
  solutionQualityDeficit: 1_000,
  ammoScarcity: 1_500,
  friendlyCoveragePressure: 1_000,
  overkill: 1_000,
};
export const TORPEDO_SALVO_BP_PER_TUBE = 1_000 as const;
export const TORPEDO_SALVO_MIN_TUBES = 1 as const;
export const TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE: readonly {
  maxRangeM: number;
  pressureBp: number;
}[] = [
  { maxRangeM: 2_000, pressureBp: 0 },
  { maxRangeM: 5_000, pressureBp: 2_000 },
  { maxRangeM: 8_000, pressureBp: 4_000 },
  { maxRangeM: 12_000, pressureBp: 6_000 },
  { maxRangeM: Number.MAX_SAFE_INTEGER, pressureBp: 8_000 },
];
export const TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE: readonly {
  minAmmo: number;
  scarcityBp: number;
}[] = [
  { minAmmo: 12, scarcityBp: 0 },
  { minAmmo: 8, scarcityBp: 2_000 },
  { minAmmo: 4, scarcityBp: 4_000 },
  { minAmmo: 2, scarcityBp: 6_000 },
  { minAmmo: 1, scarcityBp: 8_000 },
  { minAmmo: 0, scarcityBp: 10_000 },
];
export const TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE: readonly {
  maxCount: number;
  pressureBp: number;
}[] = [
  { maxCount: 0, pressureBp: 10_000 },
  { maxCount: 1, pressureBp: 7_000 },
  { maxCount: 2, pressureBp: 5_000 },
  { maxCount: Number.MAX_SAFE_INTEGER, pressureBp: 3_000 },
];

export const OXYGEN_RANGE_MULTIPLIER_BP = 15_000 as const;
export const OXYGEN_SPEED_MULTIPLIER_BP = 11_000 as const;
export const OXYGEN_WAKE_DETECTION_MULTIPLIER_BP = 7_500 as const;
export const OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP = 15_000 as const;
export const OXYGEN_CHAIN_REACTION_BASE_BP = 3_000 as const;

export const TORPEDO_LAUNCH_FAILURE_BASE_BP = 100 as const;
export const TORPEDO_LAUNCH_FAILURE_MIN_BP = 0 as const;
export const TORPEDO_LAUNCH_FAILURE_MAX_BP = TORPEDO_SOLUTION_FINAL_MAX_BP;
export const TORPEDO_LAUNCH_SUBSTEP = 4 as const;
export const TORPEDO_LAUNCH_FAILURE_MODEL_RELIABILITY_DIVISOR = 250 as const;
export const TORPEDO_LAUNCH_FAILURE_DAMAGE_ADJUSTMENT_BP: Record<LauncherDamageState, number> = {
  OPERATIONAL: 0,
  DAMAGED: 75,
  DESTROYED: TORPEDO_LAUNCH_FAILURE_MAX_BP,
};
export const TORPEDO_LAUNCH_FAILURE_CREW_NEUTRAL_BP = 5_000 as const;
export const TORPEDO_LAUNCH_FAILURE_CREW_ADJUSTMENT_DIVISOR = 100 as const;
export const TORPEDO_LAUNCH_FAILURE_RELIABILITY_BAND_TABLE: readonly {
  minReliabilityBp: number;
  adjustmentBp: number;
}[] = [
  { minReliabilityBp: 95_000, adjustmentBp: -25 },
  { minReliabilityBp: 92_000, adjustmentBp: 0 },
  { minReliabilityBp: 90_000, adjustmentBp: 25 },
  { minReliabilityBp: 0, adjustmentBp: 50 },
];
export const TORPEDO_STUCK_IN_TUBE_SHARE_BP = 3_000 as const;
export const NO_TARGET_CONTACT = "NONE" as const;
export const TORPEDO_TERMINAL_RESULTS = [
  "HIT",
  "DETONATION",
  "DUD",
  "GROUNDING",
  "EXHAUSTION",
  "DESTRUCTION",
  "BATTLE_END",
] as const;
export type TorpedoTerminalResult = (typeof TORPEDO_TERMINAL_RESULTS)[number];
export const TORPEDO_MINUTE_MS = SUBSTEPS_PER_MINUTE * SUBSTEP_SECONDS * 1_000;
export const TORPEDO_TRACK_MDEG_PER_DEGREE = 1_000;

export const SEED_TORPEDO_MODEL_IDS = [
  "whitehead_18in_1894",
  "rn_21in_mk_iv_1916",
  "ger_533mm_g7a_1934",
  "ger_533mm_g7e_1936",
  "jpn_61cm_type93_1935",
  "whitehead_14in_1886",
  "rn_21in_mk_viii_1927",
  "usn_21in_mk14_1931",
] as const;
export type SeedTorpedoModelId = (typeof SEED_TORPEDO_MODEL_IDS)[number];

export interface TorpedoContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  speedBpScale: number;
  knotsToUmS: number;
  reliabilityScale: number;
  mountTypes: readonly TorpedoMountType[];
  propulsionTypes: readonly TorpedoPropulsionType[];
  warheadTypes: readonly TorpedoWarheadType[];
  tubeHitHazardPolicies: readonly TubeHitHazardPolicy[];
  fireControlConnectionStates: readonly FireControlConnectionState[];
  launcherDamageStates: readonly LauncherDamageState[];
  floodingIsolationStates: readonly FloodingIsolationState[];
  underwaterTubeMaxSpeedKnots: number;
  underwaterTubeMaxSpeedUmS: number;
  aboveWaterFixedMaxLaunchSpeedKnots: number;
  aboveWaterTrainableMaxLaunchSpeedKnots: number;
  targetContactMinimumBp: number;
  solutionMinimumBp: Record<TorpedoLaunchKind, number>;
  maxLaunchSeaState: number;
  oxygenRangeMultiplierBp: number;
  oxygenSpeedMultiplierBp: number;
  oxygenWakeDetectionMultiplierBp: number;
  oxygenTubeHitSevereFloodingMultiplierBp: number;
  oxygenChainReactionBaseBp: number;
  solutionFactorKeys: readonly string[];
  solutionScaleExponent: number;
  solutionRounding: string;
  neutralSolutionMultiplierBp: number;
  solutionFinalMinBp: number;
  solutionFinalMaxBp: number;
  friendlyDangerSectorMinimumBp: number;
  friendlyFireMinSeparationM: number;
  dangerSectorRadToMdeg: number;
  friendlyFireLowConfidenceBp: number;
  unidentifiedContactIdentity: string;
  missionObjectives: readonly string[];
  withdrawalStates: readonly string[];
  salvoBaseTubes: Record<string, number>;
  salvoWithdrawalModifierTubes: Record<string, number>;
  salvoFactorKeys: readonly string[];
  salvoFactorWeightsBp: Record<string, number>;
  salvoBpPerTube: number;
  salvoMinTubes: number;
  salvoRangePressureBpTable: readonly { maxRangeM: number; pressureBp: number }[];
  salvoAmmoScarcityBpTable: readonly { minAmmo: number; scarcityBp: number }[];
  salvoFriendlyLauncherPressureBpTable: readonly { maxCount: number; pressureBp: number }[];
  launchFailureBaseBp: number;
  launchFailureMinBp: number;
  launchFailureMaxBp: number;
  launchSubstep: number;
  launchFailureModelReliabilityDivisor: number;
  launchFailureDamageAdjustmentBp: Record<LauncherDamageState, number>;
  launchFailureCrewNeutralBp: number;
  launchFailureCrewAdjustmentDivisor: number;
  launchFailureReliabilityBandTable: readonly { minReliabilityBp: number; adjustmentBp: number }[];
  stuckInTubeShareBp: number;
  terminalResults: readonly string[];
  noTargetContact: string;
  torpedoMinuteMs: number;
  trackMdegPerDegree: number;
  shippedModelIds: readonly string[];
}

export const SHIPPED_TORPEDO_CONTRACT: TorpedoContract = {
  policyId: torpedoPolicyId,
  rulesetVersion: TORPEDO_RULESET_VERSION,
  formulaVersion: TORPEDO_FORMULA_VERSION,
  basisPointsPerUnit: TORPEDO_BASIS_POINTS_PER_UNIT,
  speedBpScale: TORPEDO_SPEED_BP_SCALE,
  knotsToUmS: TORPEDO_KNOTS_TO_UM_S,
  reliabilityScale: TORPEDO_RELIABILITY_SCALE,
  mountTypes: TORPEDO_MOUNT_TYPES,
  propulsionTypes: TORPEDO_PROPULSION_TYPES,
  warheadTypes: TORPEDO_WARHEAD_TYPES,
  tubeHitHazardPolicies: TUBE_HIT_HAZARD_POLICIES,
  fireControlConnectionStates: FIRE_CONTROL_CONNECTION_STATES,
  launcherDamageStates: LAUNCHER_DAMAGE_STATES,
  floodingIsolationStates: FLOODING_ISOLATION_STATES,
  underwaterTubeMaxSpeedKnots: UNDERWATER_TUBE_MAX_SPEED_KNOTS,
  underwaterTubeMaxSpeedUmS: UNDERWATER_TUBE_MAX_SPEED_UM_S,
  aboveWaterFixedMaxLaunchSpeedKnots: ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS,
  aboveWaterTrainableMaxLaunchSpeedKnots: ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS,
  targetContactMinimumBp: TORPEDO_TARGET_CONTACT_MINIMUM_BP,
  solutionMinimumBp: TORPEDO_SOLUTION_MINIMUM_BP,
  maxLaunchSeaState: TORPEDO_MAX_LAUNCH_SEA_STATE,
  oxygenRangeMultiplierBp: OXYGEN_RANGE_MULTIPLIER_BP,
  oxygenSpeedMultiplierBp: OXYGEN_SPEED_MULTIPLIER_BP,
  oxygenWakeDetectionMultiplierBp: OXYGEN_WAKE_DETECTION_MULTIPLIER_BP,
  oxygenTubeHitSevereFloodingMultiplierBp: OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP,
  oxygenChainReactionBaseBp: OXYGEN_CHAIN_REACTION_BASE_BP,
  solutionFactorKeys: TORPEDO_SOLUTION_FACTOR_KEYS,
  solutionScaleExponent: TORPEDO_SOLUTION_SCALE_EXPONENT,
  solutionRounding: TORPEDO_SOLUTION_ROUNDING,
  neutralSolutionMultiplierBp: NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP,
  solutionFinalMinBp: TORPEDO_SOLUTION_FINAL_MIN_BP,
  solutionFinalMaxBp: TORPEDO_SOLUTION_FINAL_MAX_BP,
  friendlyDangerSectorMinimumBp: TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP,
  friendlyFireMinSeparationM: TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M,
  dangerSectorRadToMdeg: TORPEDO_DANGER_SECTOR_RAD_TO_MDEG,
  friendlyFireLowConfidenceBp: TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP,
  unidentifiedContactIdentity: UNIDENTIFIED_CONTACT_IDENTITY,
  missionObjectives: TORPEDO_MISSION_OBJECTIVES,
  withdrawalStates: TORPEDO_WITHDRAWAL_STATES,
  salvoBaseTubes: TORPEDO_SALVO_BASE_TUBES,
  salvoWithdrawalModifierTubes: TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES,
  salvoFactorKeys: TORPEDO_SALVO_FACTOR_KEYS,
  salvoFactorWeightsBp: TORPEDO_SALVO_FACTOR_WEIGHTS_BP,
  salvoBpPerTube: TORPEDO_SALVO_BP_PER_TUBE,
  salvoMinTubes: TORPEDO_SALVO_MIN_TUBES,
  salvoRangePressureBpTable: TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE,
  salvoAmmoScarcityBpTable: TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE,
  salvoFriendlyLauncherPressureBpTable: TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE,
  launchFailureBaseBp: TORPEDO_LAUNCH_FAILURE_BASE_BP,
  launchFailureMinBp: TORPEDO_LAUNCH_FAILURE_MIN_BP,
  launchFailureMaxBp: TORPEDO_LAUNCH_FAILURE_MAX_BP,
  launchSubstep: TORPEDO_LAUNCH_SUBSTEP,
  launchFailureModelReliabilityDivisor: TORPEDO_LAUNCH_FAILURE_MODEL_RELIABILITY_DIVISOR,
  launchFailureDamageAdjustmentBp: TORPEDO_LAUNCH_FAILURE_DAMAGE_ADJUSTMENT_BP,
  launchFailureCrewNeutralBp: TORPEDO_LAUNCH_FAILURE_CREW_NEUTRAL_BP,
  launchFailureCrewAdjustmentDivisor: TORPEDO_LAUNCH_FAILURE_CREW_ADJUSTMENT_DIVISOR,
  launchFailureReliabilityBandTable: TORPEDO_LAUNCH_FAILURE_RELIABILITY_BAND_TABLE,
  stuckInTubeShareBp: TORPEDO_STUCK_IN_TUBE_SHARE_BP,
  terminalResults: TORPEDO_TERMINAL_RESULTS,
  noTargetContact: NO_TARGET_CONTACT,
  torpedoMinuteMs: TORPEDO_MINUTE_MS,
  trackMdegPerDegree: TORPEDO_TRACK_MDEG_PER_DEGREE,
  shippedModelIds: SEED_TORPEDO_MODEL_IDS,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function recordEquals(
  a: Record<string, number> | null | undefined,
  b: Record<string, number>,
): boolean {
  if (!a) return false;
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!arrayEquals(aKeys, bKeys)) return false;
  return bKeys.every((k) => a[k] === b[k]);
}

function bandTableEquals<T extends Record<string, number>>(
  a: readonly T[] | null | undefined,
  b: readonly T[],
): boolean {
  if (!a || a.length !== b.length) return false;
  return a.every((band, i) => {
    const expected = b[i];
    if (expected === undefined) return false;
    return Object.keys(expected).every((k) => band[k] === expected[k]);
  });
}

export function validateTorpedoContract(
  c: Partial<TorpedoContract> | null | undefined,
): asserts c is TorpedoContract {
  if (!c) throwMismatch(c, "torpedo_v1 missing contract");
  if (c.policyId !== torpedoPolicyId) throwMismatch(c, "torpedo_v1 expectant policy id");
  if (c.rulesetVersion !== TORPEDO_RULESET_VERSION || c.formulaVersion !== TORPEDO_FORMULA_VERSION)
    throwMismatch(c, "torpedo_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== TORPEDO_BASIS_POINTS_PER_UNIT)
    throwMismatch(c, "torpedo_v1 basis-point scale");
  if (c.speedBpScale !== TORPEDO_SPEED_BP_SCALE || c.knotsToUmS !== TORPEDO_KNOTS_TO_UM_S)
    throwMismatch(c, "torpedo_v1 speed scale (knots bp / µm-s conversion)");
  if (c.reliabilityScale !== TORPEDO_RELIABILITY_SCALE)
    throwMismatch(c, "torpedo_v1 reliability scale");
  if (!c.mountTypes || !arrayEquals(c.mountTypes, TORPEDO_MOUNT_TYPES))
    throwMismatch(c, "torpedo_v1 mount-type closed enum (§2)");
  if (!c.propulsionTypes || !arrayEquals(c.propulsionTypes, TORPEDO_PROPULSION_TYPES))
    throwMismatch(c, "torpedo_v1 propulsion-type set");
  if (!c.warheadTypes || !arrayEquals(c.warheadTypes, TORPEDO_WARHEAD_TYPES))
    throwMismatch(c, "torpedo_v1 warhead-type set");
  if (!c.tubeHitHazardPolicies || !arrayEquals(c.tubeHitHazardPolicies, TUBE_HIT_HAZARD_POLICIES))
    throwMismatch(c, "torpedo_v1 tube-hit-hazard policy set");
  if (
    !c.fireControlConnectionStates ||
    !arrayEquals(c.fireControlConnectionStates, FIRE_CONTROL_CONNECTION_STATES)
  )
    throwMismatch(c, "torpedo_v1 fire-control connection states");
  if (!c.launcherDamageStates || !arrayEquals(c.launcherDamageStates, LAUNCHER_DAMAGE_STATES))
    throwMismatch(c, "torpedo_v1 launcher damage states");
  if (
    !c.floodingIsolationStates ||
    !arrayEquals(c.floodingIsolationStates, FLOODING_ISOLATION_STATES)
  )
    throwMismatch(c, "torpedo_v1 flooding-isolation states");
  if (
    c.underwaterTubeMaxSpeedKnots !== UNDERWATER_TUBE_MAX_SPEED_KNOTS ||
    c.underwaterTubeMaxSpeedUmS !== UNDERWATER_TUBE_MAX_SPEED_UM_S
  )
    throwMismatch(c, "torpedo_v1 §7 underwater-tube speed limit");
  if (
    c.aboveWaterFixedMaxLaunchSpeedKnots !== ABOVE_WATER_FIXED_MAX_LAUNCH_SPEED_KNOTS ||
    c.aboveWaterTrainableMaxLaunchSpeedKnots !== ABOVE_WATER_TRAINABLE_MAX_LAUNCH_SPEED_KNOTS
  )
    throwMismatch(c, "torpedo_v1 §8 above-water launch speed defaults");
  if (c.targetContactMinimumBp !== TORPEDO_TARGET_CONTACT_MINIMUM_BP)
    throwMismatch(c, "torpedo_v1 §6 target contact minimum");
  if (!c.solutionMinimumBp) throwMismatch(c, "torpedo_v1 §10 solution minimums missing");
  if (!arrayEquals(Object.keys(c.solutionMinimumBp).sort(), [...TORPEDO_LAUNCH_KINDS].sort()))
    throwMismatch(c, "torpedo_v1 §10 solution-minimum launch-kind set");
  for (const kind of TORPEDO_LAUNCH_KINDS) {
    if (c.solutionMinimumBp[kind] !== TORPEDO_SOLUTION_MINIMUM_BP[kind])
      throwMismatch(c, `torpedo_v1 §10 solution minimum for launch kind ${kind}`);
  }
  if (c.maxLaunchSeaState !== TORPEDO_MAX_LAUNCH_SEA_STATE)
    throwMismatch(c, "torpedo_v1 §6 sea-state launch ceiling");
  if (
    c.oxygenRangeMultiplierBp !== OXYGEN_RANGE_MULTIPLIER_BP ||
    c.oxygenSpeedMultiplierBp !== OXYGEN_SPEED_MULTIPLIER_BP ||
    c.oxygenWakeDetectionMultiplierBp !== OXYGEN_WAKE_DETECTION_MULTIPLIER_BP ||
    c.oxygenTubeHitSevereFloodingMultiplierBp !== OXYGEN_TUBE_HIT_SEVERE_FLOODING_MULTIPLIER_BP ||
    c.oxygenChainReactionBaseBp !== OXYGEN_CHAIN_REACTION_BASE_BP
  )
    throwMismatch(c, "torpedo_v1 §23 oxygen effects");
  if (!c.solutionFactorKeys || !arrayEquals(c.solutionFactorKeys, TORPEDO_SOLUTION_FACTOR_KEYS))
    throwMismatch(c, "torpedo_v1 §10 solution factor manifest");
  if (c.solutionScaleExponent !== TORPEDO_SOLUTION_SCALE_EXPONENT)
    throwMismatch(c, "torpedo_v1 §10 solution scale exponent");
  if (c.solutionRounding !== TORPEDO_SOLUTION_ROUNDING)
    throwMismatch(c, "torpedo_v1 §10 solution rounding");
  if (c.neutralSolutionMultiplierBp !== NEUTRAL_TORPEDO_SOLUTION_MULTIPLIER_BP)
    throwMismatch(c, "torpedo_v1 §10 neutral solution multiplier");
  if (c.solutionFinalMinBp !== TORPEDO_SOLUTION_FINAL_MIN_BP)
    throwMismatch(c, "torpedo_v1 §10 solution final min");
  if (c.solutionFinalMaxBp !== TORPEDO_SOLUTION_FINAL_MAX_BP)
    throwMismatch(c, "torpedo_v1 §10 solution final max");
  if (c.friendlyDangerSectorMinimumBp !== TORPEDO_FRIENDLY_DANGER_SECTOR_MINIMUM_BP)
    throwMismatch(c, "torpedo_v1 §10/§24 friendly danger-sector minimum");
  if (c.friendlyFireMinSeparationM !== TORPEDO_FRIENDLY_FIRE_MIN_SEPARATION_M)
    throwMismatch(c, "torpedo_v1 §24 friendly-fire minimum separation");
  if (c.dangerSectorRadToMdeg !== TORPEDO_DANGER_SECTOR_RAD_TO_MDEG)
    throwMismatch(c, "torpedo_v1 §24 danger-sector rad-to-mdeg");
  if (c.friendlyFireLowConfidenceBp !== TORPEDO_FRIENDLY_FIRE_LOW_CONFIDENCE_BP)
    throwMismatch(c, "torpedo_v1 §24 friendly-fire low-confidence gate");
  if (c.unidentifiedContactIdentity !== UNIDENTIFIED_CONTACT_IDENTITY)
    throwMismatch(c, "torpedo_v1 §24 unidentified identity marker");
  if (!c.missionObjectives || !arrayEquals(c.missionObjectives, TORPEDO_MISSION_OBJECTIVES))
    throwMismatch(c, "torpedo_v1 §11 mission-objective closed enum");
  if (!c.withdrawalStates || !arrayEquals(c.withdrawalStates, TORPEDO_WITHDRAWAL_STATES))
    throwMismatch(c, "torpedo_v1 §11 withdrawal-state closed enum");
  if (!recordEquals(c.salvoBaseTubes, TORPEDO_SALVO_BASE_TUBES))
    throwMismatch(c, "torpedo_v1 §11 salvo base tubes");
  if (!recordEquals(c.salvoWithdrawalModifierTubes, TORPEDO_SALVO_WITHDRAWAL_MODIFIER_TUBES))
    throwMismatch(c, "torpedo_v1 §11 salvo withdrawal modifier");
  if (!c.salvoFactorKeys || !arrayEquals(c.salvoFactorKeys, TORPEDO_SALVO_FACTOR_KEYS))
    throwMismatch(c, "torpedo_v1 §11 salvo factor manifest");
  if (!recordEquals(c.salvoFactorWeightsBp, TORPEDO_SALVO_FACTOR_WEIGHTS_BP))
    throwMismatch(c, "torpedo_v1 §11 salvo factor weights");
  if (c.salvoBpPerTube !== TORPEDO_SALVO_BP_PER_TUBE)
    throwMismatch(c, "torpedo_v1 §11 salvo bp per tube");
  if (c.salvoMinTubes !== TORPEDO_SALVO_MIN_TUBES)
    throwMismatch(c, "torpedo_v1 §11 salvo minimum tubes");
  if (!bandTableEquals(c.salvoRangePressureBpTable, TORPEDO_SALVO_RANGE_PRESSURE_BP_TABLE))
    throwMismatch(c, "torpedo_v1 §11 salvo range-pressure bands");
  if (!bandTableEquals(c.salvoAmmoScarcityBpTable, TORPEDO_SALVO_AMMO_SCARCITY_BP_TABLE))
    throwMismatch(c, "torpedo_v1 §11 salvo ammo-scarcity bands");
  if (
    !bandTableEquals(
      c.salvoFriendlyLauncherPressureBpTable,
      TORPEDO_SALVO_FRIENDLY_LAUNCHER_PRESSURE_BP_TABLE,
    )
  )
    throwMismatch(c, "torpedo_v1 §11 salvo friendly-launcher pressure bands");
  if (c.launchFailureBaseBp !== TORPEDO_LAUNCH_FAILURE_BASE_BP)
    throwMismatch(c, "torpedo_v1 §12 launch-failure base (100 bp)");
  if (c.launchFailureMinBp !== TORPEDO_LAUNCH_FAILURE_MIN_BP)
    throwMismatch(c, "torpedo_v1 §12 launch-failure min");
  if (c.launchFailureMaxBp !== TORPEDO_LAUNCH_FAILURE_MAX_BP)
    throwMismatch(c, "torpedo_v1 §12 launch-failure max");
  if (c.launchSubstep !== TORPEDO_LAUNCH_SUBSTEP)
    throwMismatch(c, "torpedo_v1 §12 declared firing substep");
  if (c.launchFailureModelReliabilityDivisor !== TORPEDO_LAUNCH_FAILURE_MODEL_RELIABILITY_DIVISOR)
    throwMismatch(c, "torpedo_v1 §12 model-reliability modifier divisor");
  if (!recordEquals(c.launchFailureDamageAdjustmentBp, TORPEDO_LAUNCH_FAILURE_DAMAGE_ADJUSTMENT_BP))
    throwMismatch(c, "torpedo_v1 §12 launcher-damage modifier table");
  if (c.launchFailureCrewNeutralBp !== TORPEDO_LAUNCH_FAILURE_CREW_NEUTRAL_BP)
    throwMismatch(c, "torpedo_v1 §12 crew modifier neutral point");
  if (c.launchFailureCrewAdjustmentDivisor !== TORPEDO_LAUNCH_FAILURE_CREW_ADJUSTMENT_DIVISOR)
    throwMismatch(c, "torpedo_v1 §12 crew modifier divisor");
  if (
    !bandTableEquals(
      c.launchFailureReliabilityBandTable,
      TORPEDO_LAUNCH_FAILURE_RELIABILITY_BAND_TABLE,
    )
  )
    throwMismatch(c, "torpedo_v1 §12 reliability-band modifier table");
  if (c.stuckInTubeShareBp !== TORPEDO_STUCK_IN_TUBE_SHARE_BP)
    throwMismatch(c, "torpedo_v1 §12 stuck-in-tube share of failures");
  if (!c.terminalResults || !arrayEquals(c.terminalResults, TORPEDO_TERMINAL_RESULTS))
    throwMismatch(c, "torpedo_v1 §13 terminal-result closed union");
  if (c.noTargetContact !== NO_TARGET_CONTACT)
    throwMismatch(c, "torpedo_v1 §13 area-fire target marker");
  if (c.torpedoMinuteMs !== TORPEDO_MINUTE_MS)
    throwMismatch(c, "torpedo_v1 §13 track minute quantum");
  if (c.trackMdegPerDegree !== TORPEDO_TRACK_MDEG_PER_DEGREE)
    throwMismatch(c, "torpedo_v1 §13 mdeg-to-degree projection fold");
  if (!c.shippedModelIds || !arrayEquals(c.shippedModelIds, SEED_TORPEDO_MODEL_IDS))
    throwMismatch(c, "torpedo_v1 shipped model id list");
}

export function torpedoSpeedBpKnotsToUmS(speedKnotsBp: number): number {
  if (!Number.isInteger(speedKnotsBp) || speedKnotsBp <= 0) {
    throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
      code: TORPEDO_STATE_INVARIANT_FAILED,
      reason: "speed must be a positive integer in basis-point knots",
      value: speedKnotsBp,
    });
  }
  const umS = (speedKnotsBp * TORPEDO_KNOTS_TO_UM_S) / TORPEDO_SPEED_BP_SCALE;
  if (!Number.isSafeInteger(umS)) {
    throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
      code: TORPEDO_STATE_INVARIANT_FAILED,
      reason: "speed conversion produced an unsafe integer",
      speedKnotsBp,
      umS,
    });
  }
  return umS;
}
