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
  }
}
