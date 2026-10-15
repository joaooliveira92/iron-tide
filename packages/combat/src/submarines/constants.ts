//packages/combat/src/submarines/constants.ts
// DESIGN-34 versioned authoritative constant surface for the strategic
// submarine-operations lifecycle slice (C-3). Mirrors packages/combat/src/mines/
// constants.ts (ADR-0033 precedent). Every constant below is DESIGN-34's own
// shipped exact value (ticket 06 / docs/research/c3-m3-submarines.md — no
// primary-source grounding pass was required; unlike DESIGN-40 torpedo models,
// DESIGN-34 ships every mechanical integer: policy weights §5, remote-efficiency
// table §9, long-range ASW vulnerability §10, type/representation mapping §1).
//
// Pure/deterministic: fixed integer/string constants only. No I/O/clock/random.

// Versioned policy/contract ids (§1.3 of the C-3 spec): the engine-versioned
// constant set IS this subsystem's content deliverable (per ticket 06).
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

// fixed-point scale shared by every basis-point quantity in this subsystem.
export const SUBMARINE_BASIS_POINTS_PER_UNIT = 10_000 as const;

// DESIGN-34 §1 strategic representation vocab — exactly these two values.
export const STRATEGIC_REPRESENTATIONS = ["PERSISTENT_UNIT", "TYPED_FLOTILLA_POOL"] as const;
export type StrategicRepresentation = (typeof STRATEGIC_REPRESENTATIONS)[number];

// DESIGN-34 §4 canonical submarine-type enum — exactly these five values.
export const SUBMARINE_TYPES = [
  "COASTAL",
  "MEDIUM_RANGE",
  "LONG_RANGE",
  "MINELAYING",
  "MISSILE",
] as const;
export type SubmarineType = (typeof SUBMARINE_TYPES)[number];

// DESIGN-34 §6 canonical operational-mission enum — exactly these seven values.
// The full mission-eligibility predicate ships in INC-2 (AC-4); INC-1 only needs
// the closed vocabulary to populate SubmarineTypeDefinition.missionEligibility.
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

// DESIGN-34 §8 base-proximity band vocab (§8 gives the exact edge-distance bands;
// the banding predicate ships in INC-3 / AC-6). Used by the §9 remote-efficiency
// and §10 ASW-vulnerability profile tables.
export const BASE_PROXIMITY_BANDS = ["LOCAL", "REGIONAL", "REMOTE", "EXTREME_REMOTE"] as const;
export type BaseProximityBand = (typeof BASE_PROXIMITY_BANDS)[number];

// DESIGN-34 §4 "range class" — DESIGN-34 names the five canonical types but does
// not enumerate a range-class vocabulary. This is an AUTHORED closed set derived
// from the type names + §9 remote-efficiency behaviour (COASTAL is short-legged,
// MEDIUM_RANGE/MINELAYING medium, LONG_RANGE/MISSILE long), recorded as
// non-normative per ticket 06 (the type→representation mapping and the §9/§10
// tables are DESIGN-34-exact; the range-class label is a readable grouping).
export const SUBMARINE_RANGE_CLASSES = ["SHORT", "MEDIUM", "LONG"] as const;
export type SubmarineRangeClass = (typeof SUBMARINE_RANGE_CLASSES)[number];

// DESIGN-34 §4 "base-support requirement" — DESIGN-34 §6/§8 reference accessible
// support bases but §4 does not pin a per-type requirement vocabulary. Authored
// closed shape (REQUIRED = the type needs a support base to operate at all).
export const SUBMARINE_BASE_SUPPORT_REQUIREMENTS = ["REQUIRED", "OPTIONAL"] as const;
export type SubmarineBaseSupportRequirement = (typeof SUBMARINE_BASE_SUPPORT_REQUIREMENTS)[number];

// DESIGN-34 §13 sea-state categories — exactly these four values.
export const SUBMARINE_SEA_STATE_CATEGORIES = ["CALM", "OPTIMAL", "HEAVY", "SEVERE"] as const;
export type SubmarineSeaStateCategory = (typeof SUBMARINE_SEA_STATE_CATEGORIES)[number];

// DESIGN-34 §5 canonical policy enum — exactly these three values.
export const SUBMARINE_POLICIES = ["FLEET_SUPPORT", "PRIZE_RULES", "UNRESTRICTED"] as const;
export type SubmarinePolicy = (typeof SUBMARINE_POLICIES)[number];

// DESIGN-34 §5 shipped target-allocation weights. Each policy MUST sum to exactly
// SUBMARINE_BASIS_POINTS_PER_UNIT (10_000) — enforced structurally by the
// SubmarinePolicyDefinition invariant + the validate guard.
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
