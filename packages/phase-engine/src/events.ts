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
