import { BluewaveError } from "@bluewave/contracts";
import {
  BATTLE_MISSION_TYPE_UNREGISTERED,
  BATTLE_MISSION_PRIORITY_INVALID,
} from "./reasonCodes.js";

// DESIGN-37 §2 canonical mission types.
export const BATTLE_MISSION_TYPES = [
  "FLEET_BATTLE",
  "CRUISER_BATTLE",
  "COASTAL_RAID",
  "CONVOY_ATTACK",
  "CONVOY_DEFENSE",
  "INVASION",
  "RAIDER_INTERCEPTION",
  "BLOCKADE_BREAKOUT",
  "CARRIER_ACTION",
] as const;

export type BattleMissionType = (typeof BATTLE_MISSION_TYPES)[number];

// DESIGN-37 §3 shipped priorities (lower number first).
export const MISSION_PRIORITIES: Record<BattleMissionType, number> = {
  INVASION: 1,
  BLOCKADE_BREAKOUT: 2,
  CONVOY_DEFENSE: 3,
  CONVOY_ATTACK: 4,
  RAIDER_INTERCEPTION: 5,
  COASTAL_RAID: 6,
  CARRIER_ACTION: 7,
  FLEET_BATTLE: 8,
  CRUISER_BATTLE: 9,
};

// ADR B-1-3: versioned reachable subset. Only FLEET_BATTLE and CRUISER_BATTLE
// are reachable from M1 campaign state; the rest are registered but prove
// unreachable (successful empty records).
export const REACHABLE_MISSION_SUBSET_V1: ReadonlySet<BattleMissionType> = new Set([
  "FLEET_BATTLE",
  "CRUISER_BATTLE",
]);

// DESIGN-37 §2 minimum eligible combat strength.
export const FLEET_BATTLE_MIN_STRENGTH = 300;
export const CRUISER_BATTLE_MIN_STRENGTH = 150;

export interface BattleMissionDefinition {
  missionType: BattleMissionType;
  priority: number;
  opportunityPredicateId: string;
  sideSelectionPolicyId: string;
  forceRequirementPolicyId: string;
  mandatoryRoles: Record<string, string[]>;
  optionalRoles: string[];
  assetEligibilityPolicyId: string;
  generatedElementPolicyId: string;
  repairPolicyId: string;
  acceptanceClass: string;
  declineConsequencePolicyId: string;
  autoResolutionPolicyId: string;
  resultPolicyId: string;
  testVectors: string[];
  saveCompatibilityRules: string[];
}

export const MISSION_REGISTRY: Record<BattleMissionType, BattleMissionDefinition> = {
  FLEET_BATTLE: {
    missionType: "FLEET_BATTLE",
    priority: MISSION_PRIORITIES.FLEET_BATTLE,
    opportunityPredicateId: "opportunity_reachability_v1",
    sideSelectionPolicyId: "side_selection_v1",
    forceRequirementPolicyId: "fleet_battle_force_v1",
    mandatoryRoles: { ATTACKER: ["CORE"], DEFENDER: ["CORE"] },
    optionalRoles: ["SCREEN", "SCOUT", "SUPPORT"],
    assetEligibilityPolicyId: "asset_eligibility_v1",
    generatedElementPolicyId: "no_generated_elements_v1",
    repairPolicyId: "battle_composition_repair_v1",
    acceptanceClass: "OPTIONAL",
    declineConsequencePolicyId: "optional_decline_v1",
    autoResolutionPolicyId: "auto_resolution_declared_surface_v1",
    resultPolicyId: "m1_strength_result_v1",
    testVectors: [],
    saveCompatibilityRules: [],
  },
  CRUISER_BATTLE: {
    missionType: "CRUISER_BATTLE",
    priority: MISSION_PRIORITIES.CRUISER_BATTLE,
    opportunityPredicateId: "opportunity_reachability_v1",
    sideSelectionPolicyId: "side_selection_v1",
    forceRequirementPolicyId: "cruiser_battle_force_v1",
    mandatoryRoles: { ATTACKER: ["CORE"], DEFENDER: ["CORE"] },
    optionalRoles: ["SCOUT", "SCREEN"],
    assetEligibilityPolicyId: "asset_eligibility_v1",
    generatedElementPolicyId: "no_generated_elements_v1",
    repairPolicyId: "battle_composition_repair_v1",
    acceptanceClass: "OPTIONAL",
    declineConsequencePolicyId: "optional_decline_v1",
    autoResolutionPolicyId: "auto_resolution_declared_surface_v1",
    resultPolicyId: "m1_strength_result_v1",
    testVectors: [],
    saveCompatibilityRules: [],
  },
  COASTAL_RAID: {
    missionType: "COASTAL_RAID",
    priority: MISSION_PRIORITIES.COASTAL_RAID,
    opportunityPredicateId: "coastal_raid_unreachable_v1",
    sideSelectionPolicyId: "side_selection_v1",
    forceRequirementPolicyId: "coastal_raid_force_v1",
    mandatoryRoles: { ATTACKER: ["CORE"] },
    optionalRoles: [],
    assetEligibilityPolicyId: "asset_eligibility_v1",
    generatedElementPolicyId: "no_generated_elements_v1",
    repairPolicyId: "battle_composition_repair_v1",
    acceptanceClass: "OPTIONAL",
    declineConsequencePolicyId: "optional_decline_v1",
    autoResolutionPolicyId: "auto_resolution_declared_surface_v1",
    resultPolicyId: "m1_strength_result_v1",
    testVectors: [],
    saveCompatibilityRules: [],
  },
  CONVOY_ATTACK: {
    missionType: "CONVOY_ATTACK",
    priority: MISSION_PRIORITIES.CONVOY_ATTACK,
    opportunityPredicateId: "convoy_attack_unreachable_v1",
    sideSelectionPolicyId: "side_selection_v1",
    forceRequirementPolicyId: "convoy_attack_force_v1",
    mandatoryRoles: { ATTACKER: ["CORE"] },
    optionalRoles: [],
    assetEligibilityPolicyId: "asset_eligibility_v1",
    generatedElementPolicyId: "no_generated_elements_v1",
    repairPolicyId: "battle_composition_repair_v1",
    acceptanceClass: "OPTIONAL",
    declineConsequencePolicyId: "optional_decline_v1",
    autoResolutionPolicyId: "auto_resolution_declared_surface_v1",
    resultPolicyId: "m1_strength_result_v1",
    testVectors: [],
    saveCompatibilityRules: [],
  },
  CONVOY_DEFENSE: {
    missionType: "CONVOY_DEFENSE",
    priority: MISSION_PRIORITIES.CONVOY_DEFENSE,
    opportunityPredicateId: "convoy_defense_unreachable_v1",
    sideSelectionPolicyId: "side_selection_v1",
    forceRequirementPolicyId: "convoy_defense_force_v1",
    mandatoryRoles: { DEFENDER: ["CORE"] },
    optionalRoles: [],
    assetEligibilityPolicyId: "asset_eligibility_v1",
    generatedElementPolicyId: "no_generated_elements_v1",
    repairPolicyId: "battle_composition_repair_v1",
    acceptanceClass: "POLITICALLY_EXPECTED",
    declineConsequencePolicyId: "politically_expected_decline_v1",
    autoResolutionPolicyId: "auto_resolution_declared_surface_v1",
    resultPolicyId: "m1_strength_result_v1",
    testVectors: [],
    saveCompatibilityRules: [],
  },
  INVASION: {
    missionType: "INVASION",
    priority: MISSION_PRIORITIES.INVASION,
    opportunityPredicateId: "invasion_unreachable_v1",
    sideSelectionPolicyId: "side_selection_v1",
    forceRequirementPolicyId: "invasion_force_v1",
    mandatoryRoles: { ATTACKER: ["CORE"] },
    optionalRoles: [],
    assetEligibilityPolicyId: "asset_eligibility_v1",
    generatedElementPolicyId: "amphibious_generated_v1",
    repairPolicyId: "battle_composition_repair_v1",
    acceptanceClass: "OPERATIONALLY_UNAVOIDABLE",
    declineConsequencePolicyId: "unavoidable_decline_v1",
    autoResolutionPolicyId: "auto_resolution_declared_surface_v1",
    resultPolicyId: "m1_strength_result_v1",
    testVectors: [],
    saveCompatibilityRules: [],
  },
  RAIDER_INTERCEPTION: {
    missionType: "RAIDER_INTERCEPTION",
    priority: MISSION_PRIORITIES.RAIDER_INTERCEPTION,
    opportunityPredicateId: "raider_interception_unreachable_v1",
    sideSelectionPolicyId: "side_selection_v1",
    forceRequirementPolicyId: "raider_interception_force_v1",
    mandatoryRoles: { ATTACKER: ["CORE"] },
    optionalRoles: [],
    assetEligibilityPolicyId: "asset_eligibility_v1",
    generatedElementPolicyId: "no_generated_elements_v1",
    repairPolicyId: "battle_composition_repair_v1",
    acceptanceClass: "OPTIONAL",
    declineConsequencePolicyId: "optional_decline_v1",
    autoResolutionPolicyId: "auto_resolution_declared_surface_v1",
    resultPolicyId: "m1_strength_result_v1",
    testVectors: [],
    saveCompatibilityRules: [],
  },
  BLOCKADE_BREAKOUT: {
    missionType: "BLOCKADE_BREAKOUT",
    priority: MISSION_PRIORITIES.BLOCKADE_BREAKOUT,
    opportunityPredicateId: "blockade_breakout_unreachable_v1",
    sideSelectionPolicyId: "side_selection_v1",
    forceRequirementPolicyId: "blockade_breakout_force_v1",
    mandatoryRoles: { ATTACKER: ["CORE"] },
    optionalRoles: [],
    assetEligibilityPolicyId: "asset_eligibility_v1",
    generatedElementPolicyId: "no_generated_elements_v1",
    repairPolicyId: "battle_composition_repair_v1",
    acceptanceClass: "OPERATIONALLY_UNAVOIDABLE",
    declineConsequencePolicyId: "unavoidable_decline_v1",
    autoResolutionPolicyId: "auto_resolution_declared_surface_v1",
    resultPolicyId: "m1_strength_result_v1",
    testVectors: [],
    saveCompatibilityRules: [],
  },
  CARRIER_ACTION: {
    missionType: "CARRIER_ACTION",
    priority: MISSION_PRIORITIES.CARRIER_ACTION,
    opportunityPredicateId: "carrier_action_unreachable_v1",
    sideSelectionPolicyId: "side_selection_v1",
    forceRequirementPolicyId: "carrier_action_force_v1",
    mandatoryRoles: { ATTACKER: ["CORE"] },
    optionalRoles: [],
    assetEligibilityPolicyId: "asset_eligibility_v1",
    generatedElementPolicyId: "carrier_generated_v1",
    repairPolicyId: "battle_composition_repair_v1",
    acceptanceClass: "OPTIONAL",
    declineConsequencePolicyId: "optional_decline_v1",
    autoResolutionPolicyId: "auto_resolution_declared_surface_v1",
    resultPolicyId: "m1_strength_result_v1",
    testVectors: [],
    saveCompatibilityRules: [],
  },
};

export function getMission(missionType: string): BattleMissionDefinition {
  const def = MISSION_REGISTRY[missionType as BattleMissionType];
  if (!def) {
    throw new BluewaveError(BATTLE_MISSION_TYPE_UNREGISTERED, {
      code: BATTLE_MISSION_TYPE_UNREGISTERED,
      missionType,
    });
  }
  return def;
}

export function assertPrioritiesUnique(): void {
  const seen = new Set<number>();
  for (const t of BATTLE_MISSION_TYPES) {
    const p = MISSION_PRIORITIES[t];
    if (p === undefined || seen.has(p)) {
      throw new BluewaveError(BATTLE_MISSION_PRIORITY_INVALID, {
        code: BATTLE_MISSION_PRIORITY_INVALID,
        missionType: t,
        priority: p,
      });
    }
    seen.add(p);
  }
  if (seen.size !== 9) {
    throw new BluewaveError(BATTLE_MISSION_PRIORITY_INVALID, {
      code: BATTLE_MISSION_PRIORITY_INVALID,
      reason: "must be exactly nine unique priorities",
      size: seen.size,
    });
  }
}

assertPrioritiesUnique();
