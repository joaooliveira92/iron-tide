import type { DomainEventBody } from "@bluewave/events";
import type { EffectReference, EntityReference, Interpolation } from "./schema.js";

export interface EventDescription {
  readonly interpolation: Interpolation;
  readonly subjectRefs: readonly EntityReference[];
  readonly effectRefs: readonly EffectReference[];
}

function nation(id: string): EntityReference {
  return { type: "nation", id };
}

/**
 * Describe one domain-event body as player-facing structured data: the
 * interpolation values its keys resolve with, the entities it concerns, and the
 * concrete effects it records. Pure and total over the frozen event union.
 */
export function describeEventBody(body: DomainEventBody): EventDescription {
  switch (body.kind) {
    case "NationBudgetChanged":
      return {
        interpolation: {
          nationId: body.nationId,
          previousTreasury: body.previousTreasury,
          newTreasury: body.newTreasury,
          delta: body.delta,
        },
        subjectRefs: [nation(body.nationId)],
        effectRefs: [
          {
            target: nation(body.nationId),
            attribute: "treasury",
            previousValue: body.previousTreasury,
            newValue: body.newTreasury,
            delta: body.delta,
            visibility: "exact",
          },
        ],
      };
    case "ConstructionProgressed":
      return {
        interpolation: {
          projectId: body.projectId,
          nationId: body.nationId,
          previousWork: body.previousWork,
          newWork: body.newWork,
          workAdded: body.workAdded,
        },
        subjectRefs: [{ type: "constructionProject", id: body.projectId }, nation(body.nationId)],
        effectRefs: [
          {
            target: { type: "constructionProject", id: body.projectId },
            attribute: "work",
            previousValue: body.previousWork,
            newValue: body.newWork,
            delta: body.workAdded,
            visibility: "exact",
          },
        ],
      };
    case "ShipRebuilt":
      return {
        interpolation: {
          projectId: body.projectId,
          nationId: body.nationId,
          shipId: body.shipId,
          fromDesignVersionId: body.fromDesignVersionId,
          toDesignVersionId: body.toDesignVersionId,
        },
        subjectRefs: [
          { type: "ship", id: body.shipId },
          { type: "constructionProject", id: body.projectId },
          nation(body.nationId),
        ],
        effectRefs: [
          {
            target: { type: "ship", id: body.shipId },
            attribute: "designVersion",
            previousValue: body.fromDesignVersionId,
            newValue: body.toDesignVersionId,
            visibility: "exact",
          },
        ],
      };
    case "ConstructionDelayed":
      return {
        interpolation: {
          projectId: body.projectId,
          nationId: body.nationId,
          reason: body.reason,
          delayMonth: body.delayMonth,
        },
        subjectRefs: [{ type: "constructionProject", id: body.projectId }, nation(body.nationId)],
        effectRefs: [
          {
            target: { type: "constructionProject", id: body.projectId },
            attribute: "delayed",
            newValue: true,
            visibility: "exact",
          },
        ],
      };
    case "ConstructionProjectCancelled":
      return {
        interpolation: {
          projectId: body.projectId,
          nationId: body.nationId,
          projectType: body.projectType,
          consumedWork: body.consumedWork,
          refundedAmount: body.refundedAmount,
          lostAmount: body.lostAmount,
          salvageableAmount: body.salvageableAmount,
          reason: body.reason,
        },
        subjectRefs: [{ type: "constructionProject", id: body.projectId }, nation(body.nationId)],
        effectRefs: [
          {
            target: { type: "constructionProject", id: body.projectId },
            attribute: "cancelled",
            previousValue: body.consumedWork,
            newValue: 0,
            delta: -Number(body.lostAmount),
            visibility: "exact",
          },
        ],
      };
    case "ResearchProgressed":
      return {
        interpolation: {
          nationId: body.nationId,
          techId: body.techId,
          previousPoints: body.previousPoints,
          newPoints: body.newPoints,
        },
        subjectRefs: [{ type: "technology", id: body.techId }, nation(body.nationId)],
        effectRefs: [
          {
            target: { type: "technology", id: body.techId },
            attribute: "points",
            previousValue: body.previousPoints,
            newValue: body.newPoints,
            delta: body.newPoints - body.previousPoints,
            visibility: "exact",
          },
        ],
      };
    case "TechnologyDiscovered":
      return {
        interpolation: {
          nationId: body.nationId,
          techId: body.techId,
          researchFieldId: body.researchFieldId,
          discoveryMonth: body.discoveryMonth,
          cost: body.cost,
        },
        subjectRefs: [{ type: "technology", id: body.techId }, nation(body.nationId)],
        effectRefs: [
          {
            target: { type: "technology", id: body.techId },
            attribute: "discovered",
            newValue: true,
            visibility: "exact",
          },
        ],
      };
    case "BattleInitiated":
      return {
        interpolation: {
          battleId: body.battleId,
          attackerId: body.attackerId,
          defenderId: body.defenderId,
          areaId: body.areaId,
        },
        subjectRefs: [
          { type: "battle", id: body.battleId },
          { type: "region", id: body.areaId },
          nation(body.attackerId),
          nation(body.defenderId),
        ],
        effectRefs: [],
      };
    case "BattleResolved":
      return {
        interpolation: {
          battleId: body.battleId,
          winnerId: body.winnerId,
          loserId: body.loserId,
        },
        subjectRefs: [
          { type: "battle", id: body.battleId },
          nation(body.winnerId),
          nation(body.loserId),
        ],
        effectRefs: [],
      };
    case "BattleDeclined":
      return {
        interpolation: {
          battleId: body.battleId,
          nationId: body.nationId,
          areaId: body.areaId,
          missionType: body.missionType,
          victoryPointCost: body.victoryPointCost,
          opponentCredit: body.opponentCredit,
        },
        subjectRefs: [
          { type: "battle", id: body.battleId },
          { type: "region", id: body.areaId },
          nation(body.nationId),
        ],
        effectRefs: [],
      };
    case "DeclineThresholdReached":
      return {
        interpolation: {
          nationId: body.nationId,
          battleId: body.battleId,
          count: body.count,
          threshold: body.threshold,
          scope: body.scope,
        },
        subjectRefs: [{ type: "battle", id: body.battleId }, nation(body.nationId)],
        effectRefs: [],
      };
    default:
      return { interpolation: {}, subjectRefs: [], effectRefs: [] };
  }
}
