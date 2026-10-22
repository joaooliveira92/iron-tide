export const submarineStrategicAssetPolicyId = "submarine_strategic_asset_v1" as const;
export const submarineTypesPolicyId = "submarine_types_v1" as const;
export const submarinePoliciesPolicyId = "submarine_policies_v1" as const;
export const submarineMissionsPolicyId = "submarine_missions_v1" as const;
export const submarineReliabilityPolicyId = "submarine_reliability_v1" as const;
export const submarineProximityPolicyId = "submarine_proximity_v1" as const;
export const submarineRemoteEfficiencyPolicyId = "submarine_remote_efficiency_v1" as const;
export const submarineLongRangeAswVulnerabilityPolicyId =
  "submarine_long_range_asw_vulnerability_v1" as const;
export const submarineEffectivenessPolicyId = "submarine_effectiveness_v1" as const;
export const submarineSeaStatePolicyId = "submarine_sea_state_v1" as const;
export const submarineScreeningBalancePolicyId = "submarine_screening_balance_v1" as const;
export const submarineAttackOpportunityPolicyId = "submarine_attack_opportunity_v1" as const;
export const submarineMineLayingPolicyId = "submarine_mine_laying_v1" as const;
export const submarineFriendlyIdentificationPolicyId =
  "submarine_friendly_identification_v1" as const;

export const SUBMARINE_RULESET_VERSION = "submarine_ruleset_v1" as const;
export const SUBMARINE_FORMULA_VERSION = "submarine_formula_v1" as const;

export const SUBMARINE_BASIS_POINTS_PER_UNIT = 10_000 as const;

export const STRATEGIC_REPRESENTATIONS = ["PERSISTENT_UNIT", "TYPED_FLOTILLA_POOL"] as const;
export type StrategicRepresentation = (typeof STRATEGIC_REPRESENTATIONS)[number];

export const SUBMARINE_TYPES = [
  "COASTAL",
  "MEDIUM_RANGE",
  "LONG_RANGE",
  "MINELAYING",
  "MISSILE",
] as const;
export type SubmarineType = (typeof SUBMARINE_TYPES)[number];

export const SUBMARINE_MISSIONS = [
  "FLEET_INTERDICTION",
  "MERCHANT_RAIDING",
  "MINE_LAYING",
  "RECONNAISSANCE",
  "TACTICAL_BATTLE_SUPPORT",
  "RETURNING_SHIP_INTERCEPTION",
  "MISSILE_PATROL",
] as const;
export type SubmarineMission = (typeof SUBMARINE_MISSIONS)[number];

export const BASE_PROXIMITY_BANDS = ["LOCAL", "REGIONAL", "REMOTE", "EXTREME_REMOTE"] as const;
export type BaseProximityBand = (typeof BASE_PROXIMITY_BANDS)[number];

export const SUBMARINE_RANGE_CLASSES = ["SHORT", "MEDIUM", "LONG"] as const;
export type SubmarineRangeClass = (typeof SUBMARINE_RANGE_CLASSES)[number];

export const SUBMARINE_BASE_SUPPORT_REQUIREMENTS = ["REQUIRED", "OPTIONAL"] as const;
export type SubmarineBaseSupportRequirement = (typeof SUBMARINE_BASE_SUPPORT_REQUIREMENTS)[number];

export const SUBMARINE_SEA_STATE_CATEGORIES = ["CALM", "OPTIMAL", "HEAVY", "SEVERE"] as const;
export type SubmarineSeaStateCategory = (typeof SUBMARINE_SEA_STATE_CATEGORIES)[number];

export const SUBMARINE_POLICIES = ["FLEET_SUPPORT", "PRIZE_RULES", "UNRESTRICTED"] as const;
export type SubmarinePolicy = (typeof SUBMARINE_POLICIES)[number];

export const SUBMARINE_POLICY_TARGET_WEIGHTS_BP: Readonly<
  Record<
    SubmarinePolicy,
    Readonly<{
      warshipAttackBp: number;
      merchantAttackBp: number;
      neutralIncidentMultiplierBp: number;
    }>
  >
> = {
  FLEET_SUPPORT: {
    warshipAttackBp: 8_000,
    merchantAttackBp: 2_000,
    neutralIncidentMultiplierBp: 5_000,
  },
  PRIZE_RULES: {
    warshipAttackBp: 5_000,
    merchantAttackBp: 5_000,
    neutralIncidentMultiplierBp: 10_000,
  },
  UNRESTRICTED: {
    warshipAttackBp: 2_500,
    merchantAttackBp: 7_500,
    neutralIncidentMultiplierBp: 20_000,
  },
};
