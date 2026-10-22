import type { OutflowSettlement } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { DomainEventEnvelope, PrestigeChanged as PrestigeChangedBody } from "@bluewave/events";
import type { LedgerTransactionInput } from "./financial-ledger.js";

export const CURRENT_VERSION = "0.1.0" as const;

export function budgetChangedEvent(
  nationId: string,
  previousTreasury: SafeInt,
  newTreasury: SafeInt,
  delta: SafeInt,
  reason: string,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `NationBudgetChanged-${nationId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "NationBudgetChanged",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "NationBudgetChanged",
      nationId,
      previousTreasury,
      newTreasury,
      delta,
      reason,
    },
    sequenceNumber: seq,
  };
}

export function shipRebuiltEvent(
  projectId: string,
  nationId: string,
  shipId: string,
  fromDesignVersionId: string,
  toDesignVersionId: string,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `ShipRebuilt-${projectId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "construction",
    aggregateId: projectId,
    eventType: "ShipRebuilt",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "ShipRebuilt",
      projectId,
      nationId,
      shipId,
      fromDesignVersionId,
      toDesignVersionId,
    },
    sequenceNumber: seq,
  };
}

export function constructionProgressedEvent(
  projectId: string,
  nationId: string,
  previousWork: SafeInt,
  newWork: SafeInt,
  workAdded: SafeInt,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `ConstructionProgressed-${projectId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "construction",
    aggregateId: projectId,
    eventType: "ConstructionProgressed",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "ConstructionProgressed",
      projectId,
      nationId,
      previousWork,
      newWork,
      workAdded,
    },
    sequenceNumber: seq,
  };
}

export function constructionProjectCancelledEvent(
  projectId: string,
  nationId: string,
  projectType: string,
  consumedWork: SafeInt,
  refundedAmount: SafeInt,
  lostAmount: SafeInt,
  salvageableAmount: SafeInt,
  reason: string,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `ConstructionProjectCancelled-${projectId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "construction",
    aggregateId: projectId,
    eventType: "ConstructionProjectCancelled",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "ConstructionProjectCancelled",
      projectId,
      nationId,
      projectType,
      consumedWork,
      refundedAmount,
      lostAmount,
      salvageableAmount,
      reason,
    },
    sequenceNumber: seq,
  };
}

export function constructionDelayedEvent(
  projectId: string,
  nationId: string,
  reason: string,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `ConstructionDelayed-${projectId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "construction",
    aggregateId: projectId,
    eventType: "ConstructionDelayed",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "ConstructionDelayed",
      projectId,
      nationId,
      reason,
      delayMonth: campaignMonth,
    },
    sequenceNumber: seq,
  };
}

export function researchProgressedEvent(
  nationId: string,
  techId: string,
  previousPoints: SafeInt,
  newPoints: SafeInt,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `ResearchProgressed-${nationId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "research",
    aggregateId: techId,
    eventType: "ResearchProgressed",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "ResearchProgressed",
      nationId,
      techId,
      previousPoints,
      newPoints,
    },
    sequenceNumber: seq,
  };
}

export function shipReadinessChangedEvent(
  shipId: string,
  nationId: string,
  fromReadiness: string,
  toReadiness: string,
  reason: string,
  crewQuality: SafeInt,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `ShipReadinessChanged-${shipId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "ship",
    aggregateId: shipId,
    eventType: "ShipReadinessChanged",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "ShipReadinessChanged",
      nationId,
      shipId,
      fromReadiness,
      toReadiness,
      reason,
      crewQuality,
    },
    sequenceNumber: seq,
  };
}

export function shipStationAssignmentChangedEvent(
  shipId: string,
  nationId: string,
  fromAssignment: string,
  toAssignment: string,
  reason: string,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `ShipStationAssignmentChanged-${shipId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "ship",
    aggregateId: shipId,
    eventType: "ShipStationAssignmentChanged",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "ShipStationAssignmentChanged",
      nationId,
      shipId,
      fromAssignment,
      toAssignment,
      reason,
    },
    sequenceNumber: seq,
  };
}

export function battleOfferAnsweredEvent(
  nationId: string,
  battleId: string,
  missionType: string,
  response: "accept" | "delegate",
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `BattleOfferAnswered-${battleId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "battle",
    aggregateId: battleId,
    eventType: "BattleOfferAnswered",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "BattleOfferAnswered",
      nationId,
      battleId,
      missionType,
      response,
      resolutionMode: "AUTO_RESOLVE",
    },
    sequenceNumber: seq,
  };
}

export function battleDeclinedEvent(
  nationId: string,
  battleId: string,
  missionType: string,
  areaId: string,
  victoryPointCost: number,
  opponentCredit: number,
  declineCount: number,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `BattleDeclined-${battleId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "battle",
    aggregateId: battleId,
    eventType: "BattleDeclined",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "BattleDeclined",
      nationId,
      battleId,
      missionType,
      areaId,
      victoryPointCost,
      opponentCredit,
      declineCount,
      reasonCode: "BATTLE_DECLINED_WITH_CONSEQUENCES",
    },
    sequenceNumber: seq,
  };
}

export function enemyDeclinedBattleEvent(
  nationId: string,
  enemyNationId: string,
  battleId: string,
  missionType: string,
  areaId: string,
  enemyVictoryPointCost: number,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `EnemyDeclinedBattle-${battleId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "battle",
    aggregateId: battleId,
    eventType: "EnemyDeclinedBattle",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "EnemyDeclinedBattle",
      nationId,
      enemyNationId,
      battleId,
      missionType,
      areaId,
      enemyVictoryPointCost,
      reasonCode: "ENEMY_DECLINED_BATTLE",
    },
    sequenceNumber: seq,
  };
}

export function prestigeChangedEvent(
  nationId: string,
  reasonCode: PrestigeChangedBody["reasonCode"],
  ruleKind: PrestigeChangedBody["ruleKind"],
  change: { readonly before: SafeInt; readonly after: SafeInt; readonly delta: SafeInt },
  rulesetVersion: string,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `PrestigeChanged-${nationId}-${reasonCode}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "PrestigeChanged",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "PrestigeChanged",
      nationId,
      reasonCode,
      ruleKind,
      before: change.before,
      after: change.after,
      delta: change.delta,
      rulesetVersion,
    },
    sequenceNumber: seq,
  };
}

export function declineThresholdReachedEvent(
  nationId: string,
  battleId: string,
  count: number,
  threshold: number,
  scope: "WAR" | "NATION" | "CAMPAIGN",
  rulesetVersion: string,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `DeclineThresholdReached-${battleId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "battle",
    aggregateId: battleId,
    eventType: "DeclineThresholdReached",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "DeclineThresholdReached",
      nationId,
      battleId,
      count,
      threshold,
      scope,
      rulesetVersion,
    },
    sequenceNumber: seq,
  };
}

export function presenceShortfallEvent(
  nationId: string,
  areaId: string,
  requiredTons: SafeInt,
  presentTons: SafeInt,
  shortfallTons: SafeInt,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `PresenceShortfall-${nationId}-${areaId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "PresenceShortfall",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "PresenceShortfall",
      nationId,
      areaId,
      requiredTons,
      presentTons,
      shortfallTons,
    },
    sequenceNumber: seq,
  };
}

export function presencePenaltyRequestEvent(
  kind: "PrestigeLossRequested" | "RevoltPressureRequested",
  nationId: string,
  areaId: string,
  shortfallTons: SafeInt,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `${kind}-${nationId}-${areaId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: kind,
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: { kind, nationId, areaId, shortfallTons },
    sequenceNumber: seq,
  };
}

function shipRoutingEvent(
  body: Extract<
    DomainEventEnvelope["body"],
    {
      kind:
        | "ShipDetachedToFleet"
        | "ShipRemovedFromDivision"
        | "ForeignStationShipMoved"
        | "ForeignStationNoRoute";
    }
  >,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `${body.kind}-${body.shipId}-${String(seq)}`,
    version: CURRENT_VERSION,
    aggregateType: "ship",
    aggregateId: body.shipId,
    eventType: body.kind,
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body,
    sequenceNumber: seq,
  };
}

export const foreignStationEvents = {
  detached: (
    nationId: string,
    shipId: string,
    fromFleetId: string,
    toFleetId: string,
    areaId: string,
    seq: SafeInt,
    month: string,
  ): DomainEventEnvelope =>
    shipRoutingEvent(
      { kind: "ShipDetachedToFleet", nationId, shipId, fromFleetId, toFleetId, areaId },
      seq,
      month,
    ),
  leftDivision: (
    nationId: string,
    shipId: string,
    divisionId: string,
    divisionDissolved: boolean,
    reason: string,
    seq: SafeInt,
    month: string,
  ): DomainEventEnvelope =>
    shipRoutingEvent(
      { kind: "ShipRemovedFromDivision", nationId, shipId, divisionId, divisionDissolved, reason },
      seq,
      month,
    ),
  moved: (
    nationId: string,
    shipId: string,
    fleetId: string,
    fromAreaId: string,
    toAreaId: string,
    targetAreaId: string,
    seq: SafeInt,
    month: string,
  ): DomainEventEnvelope =>
    shipRoutingEvent(
      {
        kind: "ForeignStationShipMoved",
        nationId,
        shipId,
        fleetId,
        fromAreaId,
        toAreaId,
        targetAreaId,
      },
      seq,
      month,
    ),
  noRoute: (
    nationId: string,
    shipId: string,
    areaId: string,
    targetAreaId: string,
    seq: SafeInt,
    month: string,
  ): DomainEventEnvelope =>
    shipRoutingEvent(
      { kind: "ForeignStationNoRoute", nationId, shipId, areaId, targetAreaId },
      seq,
      month,
    ),
};

export function makeLedgerEntry(
  nationId: string,
  phaseId: string,
  categoryId: string,
  debit: SafeInt,
  credit: SafeInt,
  previousBalance: SafeInt,
  newBalance: SafeInt,
  reason: string,
  campaignMonth: string,
  settlement?: OutflowSettlement,
): LedgerTransactionInput {
  return {
    ...(settlement === undefined
      ? {}
      : { requested: settlement.requested, shortfall: settlement.shortfall }),
    campaignMonth,
    phaseId,
    nationId,
    categoryId,
    debit,
    credit,
    previousBalance,
    newBalance,
    reason,
  };
}
