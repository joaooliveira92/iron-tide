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
  const affordable = dearestAffordableArea(snapshot, sides.otherId, sides.ownScore);
  if (affordable === undefined) return { term: undefined, reason: "NO_AFFORDABLE_AREA" };
  return { term: { _tag: "CedeArea", areaId: affordable }, reason: "PROPOSER_LEADS_BY_MARGIN" };
}

function dearestAffordableArea(
  snapshot: PeaceSnapshot,
  loserId: string,
  budget: number,
): string | undefined {
  return snapshot.world.areas
    .filter(
      (a) =>
        a.cessionCost !== undefined &&
        a.cessionCost <= budget &&
        Result.isSuccess(checkCedeArea(snapshot, loserId, a.id)),
    )
    .sort((a, b) => (b.cessionCost ?? 0) - (a.cessionCost ?? 0) || (a.id < b.id ? -1 : 1))[0]?.id;
}

export type RevolutionPeaceReason =
  | "REVOLUTION_CESSION"
  | "REVOLUTION_NO_AFFORDABLE_AREA"
  | "REVOLUTION_NOT_A_PRINCIPAL"
  | "WAR_NOT_ACTIVE";

export interface RevolutionPeaceDecision {
  readonly term: PeaceTerm | undefined;
  readonly reason: RevolutionPeaceReason;
}

export function decideRevolutionPeaceTerm(
  snapshot: PeaceSnapshot,
  warId: string,
  revoltingId: string,
): RevolutionPeaceDecision {
  const sides = sidesOf(snapshot, warId, revoltingId);
  if (typeof sides === "string") {
    return sides === "NOT_A_PRINCIPAL"
      ? { term: { _tag: "StatusQuo" }, reason: "REVOLUTION_NOT_A_PRINCIPAL" }
      : { term: undefined, reason: "WAR_NOT_ACTIVE" };
  }
  const area = dearestAffordableArea(snapshot, revoltingId, sides.otherScore);
  if (area === undefined) {
    return { term: { _tag: "StatusQuo" }, reason: "REVOLUTION_NO_AFFORDABLE_AREA" };
  }
  return { term: { _tag: "CedeArea", areaId: area }, reason: "REVOLUTION_CESSION" };
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
