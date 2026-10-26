import type { CampaignSnapshot } from "@bluewave/campaign";
import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { BATTLE_OPPORTUNITY_INELIGIBLE, BATTLE_MONTHLY_LIMIT_REACHED } from "./reasonCodes.js";
import type { BattleMissionType } from "./mission.js";
import { getMission, REACHABLE_MISSION_SUBSET_V1 } from "./mission.js";
import { compareStrings } from "../core/ordering.js";

export const OPPORTUNITY_REACHABILITY_V1 = "opportunity_reachability_v1" as const;

export type BattleOpportunityStatus =
  | "CANDIDATE"
  | "ELIGIBLE"
  | "REJECTED"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "SUPERSEDED";

export interface BattleMissionOpportunity {
  opportunityId: string;
  warId: string;
  areaId: string;
  missionType: BattleMissionType;
  missionPriority: number;
  creatingCommandId: string;
  attackerCandidateNationId: string;
  defenderCandidateNationId: string;
  objectiveIds: string[];
  earliestResolutionPhaseId: string;
  latestResolutionPhaseId: string;
  eligibilityPredicateId: string;
  acceptanceClass: string;
  declineConsequencePolicyId: string;
  status: BattleOpportunityStatus;
  inputStateHash: string;
  opportunityHash: string;
}

export interface OpportunityInputs {
  snapshot: CampaignSnapshot;
  campaignMonth: string;
  acceptedOpportunityIds: ReadonlySet<string>;
  acceptedWarAreaPairs: ReadonlySet<string>;
}

function presenceByArea(snapshot: CampaignSnapshot, nationId: string): Set<string> {
  const nation = snapshot.nations.get(nationId);
  const areas = new Set<string>();
  if (!nation) return areas;
  for (const fleet of nation.fleets) {
    for (const ship of fleet.ships) {
      if (ship.isUnderConstruction) continue;
      areas.add(ship.locationAreaId);
    }
  }
  return areas;
}

export function determineMissionOpportunities(
  inputs: OpportunityInputs,
): BattleMissionOpportunity[] {
  const { snapshot, campaignMonth } = inputs;
  const opportunities: BattleMissionOpportunity[] = [];

  for (const war of snapshot.wars.wars) {
    if (war.status !== "ACTIVE" && war.status !== "DECLARED_NOT_ACTIVE") continue;

    const attackerId = war.attackerId;
    const defenderId = war.defenderId;
    const attackerAreas = presenceByArea(snapshot, attackerId);
    const defenderAreas = presenceByArea(snapshot, defenderId);

    const sharedAreas = [...attackerAreas].filter((a) => defenderAreas.has(a));

    for (const areaId of sharedAreas) {
      for (const missionType of ["FLEET_BATTLE", "CRUISER_BATTLE"] as const) {
        if (!REACHABLE_MISSION_SUBSET_V1.has(missionType)) continue;
        const def = getMission(missionType);
        if (inputs.acceptedWarAreaPairs.has(`${war.id}:${areaId}`)) continue;

        const inputStateHash = sha256Hex(
          canonicalSerialize({ warId: war.id, areaId, month: campaignMonth }),
        );
        const opportunity: BattleMissionOpportunity = {
          opportunityId: `opp_${war.id}_${areaId}_${missionType.toLowerCase()}_${campaignMonth}`,
          warId: war.id,
          areaId,
          missionType,
          missionPriority: def.priority,
          creatingCommandId: "campaign_state_presence",
          attackerCandidateNationId: attackerId,
          defenderCandidateNationId: defenderId,
          objectiveIds: [],
          earliestResolutionPhaseId: "battle_generation",
          latestResolutionPhaseId: "battle_resolution",
          eligibilityPredicateId: OPPORTUNITY_REACHABILITY_V1,
          acceptanceClass: def.acceptanceClass,
          declineConsequencePolicyId: def.declineConsequencePolicyId,
          status: "CANDIDATE",
          inputStateHash,
          opportunityHash: "",
        };
        opportunity.opportunityHash = sha256Hex(canonicalSerialize(opportunity));
        opportunities.push(opportunity);
      }
    }
  }

  opportunities.sort((a, b) => {
    if (a.warId !== b.warId) return compareStrings(a.warId, b.warId);
    if (a.areaId !== b.areaId) return compareStrings(a.areaId, b.areaId);
    if (a.missionPriority !== b.missionPriority) return a.missionPriority - b.missionPriority;
    return compareStrings(a.opportunityId, b.opportunityId);
  });

  const perArea = new Map<string, number>();
  const limited: BattleMissionOpportunity[] = [];
  for (const opp of opportunities) {
    const areaCount = (perArea.get(opp.areaId) ?? 0) + 1;
    if (inputs.acceptedOpportunityIds.has(opp.opportunityId)) {
      limited.push(opp);
    } else if (areaCount > MAX_BATTLES_PER_AREA_PER_MONTH) {
      limited.push({ ...opp, status: "REJECTED" });
      perArea.set(opp.areaId, areaCount);
      continue;
    }
    perArea.set(opp.areaId, areaCount);
    limited.push(opp);
  }

  return limited;
}

export const MAX_BATTLES_PER_AREA_PER_MONTH = 1;

export function assertOpportunityEligible(
  opp: BattleMissionOpportunity,
  context?: Record<string, unknown>,
): void {
  if (opp.status === "REJECTED") {
    throw new BluewaveError(BATTLE_MONTHLY_LIMIT_REACHED, {
      code: BATTLE_MONTHLY_LIMIT_REACHED,
      opportunityId: opp.opportunityId,
      ...context,
    });
  }
  if (opp.status !== "CANDIDATE" && opp.status !== "ELIGIBLE") {
    throw new BluewaveError(BATTLE_OPPORTUNITY_INELIGIBLE, {
      code: BATTLE_OPPORTUNITY_INELIGIBLE,
      opportunityId: opp.opportunityId,
      status: opp.status,
      ...context,
    });
  }
}
