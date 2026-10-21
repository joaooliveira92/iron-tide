import type { OutflowSettlement } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { DomainEventEnvelope } from "@bluewave/events";
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
    // ADR-0035: domain events carry a deterministic ISO-8601 timestamp derived
    // from the campaign month (the validated DomainEventEnvelope schema
    // requires z.string().datetime). The first day of the month at UTC keeps
    // it wall-clock/locale-free and turn-distinct.
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
    // ADR-0035: deterministic ISO-8601 timestamp from the campaign month.
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

/**
 * The cancellation record of a dockyard project (DESIGN-23 section 23; DESIGN-11 settlement contract): the explicit
 * consumed/refunded/lost/salvageable settlement and the stable reason. Deterministic timestamp from the campaign month.
 */
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

/**
 * The one explicit record of a construction month that was delayed (DESIGN-23 section 7): the project advanced no work
 * and paid no ordinary charge this month. Deterministic timestamp from the campaign month, like every other domain event.
 */
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
    // ADR-0035: deterministic ISO-8601 timestamp from the campaign month.
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

/**
 * The readiness transition of a ship (S-1): the monthly crew ramp promoted a
 * working-up ship to active, or a repair countdown released a ship. Deterministic
 * timestamp from the campaign month, like every other domain event.
 */
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

/**
 * S-5: a ship's foreign-station assignment changed (assigned, cleared by command, or cleared because its readiness left
 * ACTIVE). Deterministic timestamp from the campaign month, like every other domain event.
 */
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

/**
 * T-1 03: the player answered a battle offer by accepting it or delegating it to staff. Both resolve through the
 * unchanged auto-resolution path, so this event is the durable record of the answer (and of the delegate intent).
 */
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

/**
 * T-1 04: the player declined a battle offer. One event per declined battle, carrying the war-score cost and credit that
 * were applied through the war-score seam, so scoring is auditable without reading presentation.
 */
export function battleDeclinedEvent(
  nationId: string,
  battleId: string,
  missionType: string,
  areaId: string,
  victoryPointCost: number,
  opponentCredit: number,
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
      reasonCode: "BATTLE_DECLINED_WITH_CONSEQUENCES",
    },
    sequenceNumber: seq,
  };
}

/**
 * T-1 05: a decline made the player's declined-battle count reach the ruleset threshold. One event per such decline,
 * appended right after the decline's own `BattleDeclined`. It has no effect here; the prestige ticket consumes it.
 */
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

/**
 * S-5: a nation's effective present tonnage in an area fell short of its requirement at month end. One event per
 * nation-area with a positive shortfall; emitted in (nation, area) order.
 */
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

/**
 * S-5: a typed request for S-2 (`PrestigeLossRequested`) or S-3 (`RevoltPressureRequested`) naming one nation-area
 * shortfall. Integer tons only; the consumer resolves any magnitude. Emitted right after the shortfall event.
 */
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

/** S-5 07 (ADR-0249): typed events of the foreign-station deployment, one event per fact. */
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
