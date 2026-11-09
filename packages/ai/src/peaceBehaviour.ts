import type { CampaignSnapshot, WarDeclaration } from "@bluewave/campaign";
import { checkCedeArea, type PeaceTerm } from "@bluewave/commands";
import { Result } from "effect";

export type PeaceReason =
  | "PROPOSER_LEADS_BY_MARGIN"
  | "PROPOSER_TRAILS_BY_MARGIN"
  | "SCORES_WITHIN_MARGIN"
  | "NO_AFFORDABLE_AREA"
  | "WAR_NOT_ACTIVE"
  | "NOT_A_PRINCIPAL";

export interface PeaceProposalDecision {
  readonly term: PeaceTerm | undefined;
  readonly reason: PeaceReason;
}

export interface PeaceResponseDecision {
  readonly accept: boolean;
  readonly reason: PeaceReason;
}

type PeaceSnapshot = Pick<CampaignSnapshot, "wars" | "world" | "nations">;

interface Sides {
  readonly war: WarDeclaration;
  readonly ownScore: number;
  readonly otherScore: number;
  readonly otherId: string;
}

function sidesOf(snapshot: PeaceSnapshot, warId: string, nationId: string): Sides | PeaceReason {
  const war = snapshot.wars.wars.find((w) => w.id === warId);
  if (war === undefined || war.status !== "ACTIVE") return "WAR_NOT_ACTIVE";
  if (war.attackerId === nationId)
    return {
      war,
      ownScore: war.attackerWarScore,
      otherScore: war.defenderWarScore,
      otherId: war.defenderId,
    };
  if (war.defenderId === nationId)
    return {
      war,
      ownScore: war.defenderWarScore,
      otherScore: war.attackerWarScore,
      otherId: war.attackerId,
    };
  return "NOT_A_PRINCIPAL";
}

export function decidePeaceProposal(
  snapshot: PeaceSnapshot,
  warId: string,
  nationId: string,
  margin: number,
): PeaceProposalDecision {
  const sides = sidesOf(snapshot, warId, nationId);
  if (typeof sides === "string") return { term: undefined, reason: sides };
  const lead = sides.ownScore - sides.otherScore;
  if (lead <= -margin) return { term: { _tag: "StatusQuo" }, reason: "PROPOSER_TRAILS_BY_MARGIN" };
  if (lead < margin) return { term: undefined, reason: "SCORES_WITHIN_MARGIN" };
  const affordable = snapshot.world.areas
    .filter(
      (a) =>
        a.cessionCost !== undefined &&
        a.cessionCost <= sides.ownScore &&
        Result.isSuccess(checkCedeArea(snapshot, sides.otherId, a.id)),
    )
    .sort((a, b) => (b.cessionCost ?? 0) - (a.cessionCost ?? 0) || (a.id < b.id ? -1 : 1))[0];
  if (affordable === undefined) return { term: undefined, reason: "NO_AFFORDABLE_AREA" };
  return { term: { _tag: "CedeArea", areaId: affordable.id }, reason: "PROPOSER_LEADS_BY_MARGIN" };
}

export function decidePeaceResponse(
  snapshot: PeaceSnapshot,
  warId: string,
  responderId: string,
  term: PeaceTerm,
  margin: number,
): PeaceResponseDecision {
  const sides = sidesOf(snapshot, warId, responderId);
  if (typeof sides === "string") return { accept: false, reason: sides };
  const responderLead = sides.ownScore - sides.otherScore;
  if (term._tag === "StatusQuo") {
    return responderLead >= margin
      ? { accept: false, reason: "PROPOSER_TRAILS_BY_MARGIN" }
      : { accept: true, reason: "SCORES_WITHIN_MARGIN" };
  }
  return responderLead <= -margin
    ? { accept: true, reason: "PROPOSER_LEADS_BY_MARGIN" }
    : { accept: false, reason: "SCORES_WITHIN_MARGIN" };
}
