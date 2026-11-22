import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { BattleMissionOpportunity } from "./opportunity.js";
import { getMission, type BattleMissionType } from "./mission.js";

export const OPPORTUNITY_ENCOUNTER_V1 = "opportunity_encounter_v1" as const;

export const ENCOUNTER_MISSION_SUBSET_V1: ReadonlySet<BattleMissionType> = new Set([
  "RAIDER_INTERCEPTION",
  "BLOCKADE_BREAKOUT",
]);

export interface RaiderEncounter {
  readonly missionType: "RAIDER_INTERCEPTION" | "BLOCKADE_BREAKOUT";
  readonly warId: string;
  readonly areaId: string;
  readonly raiderNationId: string;
  readonly raiderShipId: string;
  readonly interceptorNationId: string;
  readonly interceptorShipIds: readonly string[];
}

export function isEncounterOpportunity(opportunity: { missionType: BattleMissionType }): boolean {
  return ENCOUNTER_MISSION_SUBSET_V1.has(opportunity.missionType);
}

export function encounterOpportunities(
  encounters: readonly RaiderEncounter[],
  campaignMonth: string,
): BattleMissionOpportunity[] {
  return encounters.map((encounter) => {
    const def = getMission(encounter.missionType);
    const raiderAttacks = encounter.missionType === "BLOCKADE_BREAKOUT";
    const opportunity: BattleMissionOpportunity = {
      opportunityId: `opp_${encounter.warId}_${encounter.areaId}_${encounter.missionType.toLowerCase()}_${encounter.raiderShipId}_${campaignMonth}`,
      warId: encounter.warId,
      areaId: encounter.areaId,
      missionType: encounter.missionType,
      missionPriority: def.priority,
      creatingCommandId: "campaign_state_encounter",
      attackerCandidateNationId: raiderAttacks
        ? encounter.raiderNationId
        : encounter.interceptorNationId,
      defenderCandidateNationId: raiderAttacks
        ? encounter.interceptorNationId
        : encounter.raiderNationId,
      objectiveIds: [],
      earliestResolutionPhaseId: "battle_generation",
      latestResolutionPhaseId: "battle_resolution",
      eligibilityPredicateId: OPPORTUNITY_ENCOUNTER_V1,
      acceptanceClass: def.acceptanceClass,
      declineConsequencePolicyId: def.declineConsequencePolicyId,
      status: "CANDIDATE",
      inputStateHash: sha256Hex(
        canonicalSerialize({
          warId: encounter.warId,
          areaId: encounter.areaId,
          month: campaignMonth,
          raiderShipId: encounter.raiderShipId,
        }),
      ),
      opportunityHash: "",
      encounter,
    };
    opportunity.opportunityHash = sha256Hex(canonicalSerialize(opportunity));
    return opportunity;
  });
}

export function encounterShipIds(
  opportunity: { encounter?: RaiderEncounter | undefined },
  nationId: string,
): readonly string[] | undefined {
  const encounter = opportunity.encounter;
  if (encounter === undefined) return undefined;
  if (nationId === encounter.raiderNationId) return [encounter.raiderShipId];
  if (nationId === encounter.interceptorNationId) return encounter.interceptorShipIds;
  return [];
}
