import type {
  CommitMonthResponse,
  DomainEvent,
  FinancialLedgerEntry,
} from "@bluewave/campaign-engine";
import type { DomainEventBody, DomainEventEnvelope } from "@bluewave/events";
import type { LedgerTransaction } from "@bluewave/phase-engine";
import type { RandomDecision } from "@bluewave/random";

/**
 * Pure adapters from the engine's month-result ledgers to the flat, wire-safe
 * shapes `CommitMonthResponse` exposes to the renderer. No engine state is
 * read or mutated here — each function just projects its argument.
 */

export function sumByCategory(
  entries: readonly LedgerTransaction[],
  categoryIds: readonly string[],
): number {
  return entries
    .filter((entry) => categoryIds.includes(entry.categoryId))
    .reduce((sum, entry) => sum + Number(entry.debit), 0);
}

export function toFinancialLedgerEntries(
  entries: readonly LedgerTransaction[],
): FinancialLedgerEntry[] {
  return entries.map((entry) => ({
    id: entry.transactionId,
    description: entry.reason,
    phase: entry.phaseId,
    amount: Number(entry.newBalance) - Number(entry.previousBalance),
    runningBalance: Number(entry.newBalance),
    // Outflows carry what was asked for and what was left unpaid (spec #138); the paid figure is the debit.
    ...(entry.requested === undefined
      ? {}
      : { requested: Number(entry.requested), shortfall: Number(entry.shortfall ?? 0) }),
  }));
}

export function toDomainEvents(events: readonly DomainEventEnvelope[]): DomainEvent[] {
  return events.map((event) => ({
    id: event.eventId,
    kind: event.eventType,
    phase: event.aggregateType,
    message: describeDomainEventBody(event.body),
  }));
}

export function toRandomDecisions(
  decisions: readonly RandomDecision[],
): CommitMonthResponse["randomDecisions"] {
  return decisions.map((decision) => ({
    purpose: decision.streamId,
    phase: decision.phase,
    entityKey: decision.entityKey,
    value: decision.draw,
    outcome: decision.outcome,
  }));
}

function describeDomainEventBody(body: DomainEventBody): string {
  switch (body.kind) {
    case "NationBudgetChanged":
      return `${body.nationId}: treasury ${String(body.previousTreasury)} -> ${String(body.newTreasury)} (${body.reason})`;
    case "ConstructionProgressed":
      return `${body.nationId}: project ${body.projectId} work ${String(body.previousWork)} -> ${String(body.newWork)}`;
    case "ConstructionDelayed":
      return `${body.nationId}: project ${body.projectId} delayed in ${body.delayMonth} (${body.reason})`;
    case "ShipRebuilt":
      return `${body.nationId}: ship ${body.shipId} rebuilt from ${body.fromDesignVersionId} to ${body.toDesignVersionId}`;
    case "ConstructionProjectCancelled":
      return `${body.nationId}: project ${body.projectId} cancelled (${body.reason}; ${String(body.lostAmount)} lost)`;
    case "ResearchProgressed":
      return `${body.nationId}: ${body.techId} progress ${String(body.previousPoints)} -> ${String(body.newPoints)}`;
    case "BattleInitiated":
      return `Battle ${body.battleId}: ${body.attackerId} vs ${body.defenderId} in ${body.areaId}`;
    case "BattleResolved":
      return `Battle ${body.battleId}: ${body.winnerId} defeated ${body.loserId}`;
    case "TechnologyDiscovered":
      return `${body.nationId} discovered ${body.techId}`;
    case "ShipReadinessChanged":
      return `${body.nationId}: ship ${body.shipId} ${body.fromReadiness} -> ${body.toReadiness} (${body.reason})`;
    case "ShipStationAssignmentChanged":
      return `${body.nationId}: ship ${body.shipId} station ${body.fromAssignment} -> ${body.toAssignment} (${body.reason})`;
    case "BattleOfferAnswered":
      return `${body.nationId}: battle ${body.battleId} offer ${body.response === "delegate" ? "delegated to staff" : "accepted"} (${body.missionType}, ${body.resolutionMode})`;
    case "BattleDeclined":
      return `${body.nationId}: battle ${body.battleId} declined in ${body.areaId} (${body.missionType}; ${String(body.victoryPointCost)} victory points lost, ${body.reasonCode})`;
    case "DeclineThresholdReached":
      return `${body.nationId}: declined-battle count ${String(body.count)} reached the threshold of ${String(body.threshold)} (${body.scope} scope)`;
    case "EnemyDeclinedBattle":
      return `${body.nationId}: ${body.enemyNationId} declined battle ${body.battleId} in ${body.areaId} (${body.missionType}); no battle took place`;
    case "PresenceShortfall":
      return `${body.nationId}: presence in ${body.areaId} short by ${body.shortfallTons} t (${body.presentTons} of ${body.requiredTons} t)`;
    case "PrestigeLossRequested":
      return `${body.nationId}: prestige loss requested for a presence shortfall of ${body.shortfallTons} t in ${body.areaId}`;
    case "RevoltPressureRequested":
      return `${body.nationId}: revolt pressure requested for a presence shortfall of ${body.shortfallTons} t in ${body.areaId}`;
    case "ShipDetachedToFleet":
      return `${body.nationId}: ship ${body.shipId} detached from fleet ${body.fromFleetId} into fleet ${body.toFleetId} in ${body.areaId}`;
    case "ShipRemovedFromDivision":
      return `${body.nationId}: ship ${body.shipId} left division ${body.divisionId}${body.divisionDissolved ? " (division dissolved)" : ""} (${body.reason})`;
    case "ForeignStationShipMoved":
      return `${body.nationId}: foreign-station ship ${body.shipId} sailed ${body.fromAreaId} -> ${body.toAreaId} toward ${body.targetAreaId}`;
    case "ForeignStationNoRoute":
      return `${body.nationId}: foreign-station ship ${body.shipId} in ${body.areaId} has no route to ${body.targetAreaId}`;
  }
}
