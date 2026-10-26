import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import {
  buildPrioritiesProjection,
  explainReportTreasury,
  reconcileMonthLedger,
} from "@bluewave/campaign-engine";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { LedgerTransaction } from "@bluewave/phase-engine";
import type {
  MonthlyReportConstructionProgress,
  MonthlyReportDiscovery,
  MonthlyReportEntry,
  MonthlyReportResearchProgress,
  MonthlyReportShip,
} from "../../../shared/reports-contract.js";
import { sumByCategory } from "./responseMappers.js";

export interface FleetSnapshot {
  readonly fleets: readonly {
    readonly ships: readonly {
      readonly id: string;
      readonly name: string;
      readonly isUnderConstruction: boolean;
    }[];
  }[];
}

export interface ProjectSnapshot {
  readonly constructionProjects: readonly {
    readonly id: string;
    readonly status: string;
  }[];
}

export function completedShips(
  before: FleetSnapshot,
  after: FleetSnapshot,
): readonly MonthlyReportShip[] {
  const preShipIds = new Set(before.fleets.flatMap((fleet) => fleet.ships).map((ship) => ship.id));
  return after.fleets
    .flatMap((fleet) => fleet.ships)
    .filter((ship) => !ship.isUnderConstruction && !preShipIds.has(ship.id))
    .map((ship) => ({ shipId: ship.id, name: ship.name }));
}

export function newlyActiveProjectIds(
  before: ProjectSnapshot,
  after: ProjectSnapshot,
): readonly string[] {
  const preStatus = new Map(
    before.constructionProjects.map((project) => [project.id, project.status] as const),
  );
  return after.constructionProjects
    .filter((project) => project.status === "ACTIVE" && preStatus.get(project.id) !== "ACTIVE")
    .map((project) => project.id);
}

export function constructionProgressFromEvents(
  events: readonly DomainEventEnvelope[],
  nationId: string,
): readonly MonthlyReportConstructionProgress[] {
  return events.flatMap((envelope) => {
    if (envelope.body.kind !== "ConstructionProgressed") return [];
    const body = envelope.body;
    if (body.nationId !== nationId) return [];
    return [
      {
        projectId: body.projectId,
        previousWork: Number(body.previousWork),
        newWork: Number(body.newWork),
      },
    ];
  });
}

export function researchProgressFromEvents(
  events: readonly DomainEventEnvelope[],
  nationId: string,
): readonly MonthlyReportResearchProgress[] {
  return events.flatMap((envelope) => {
    if (envelope.body.kind !== "ResearchProgressed") return [];
    const body = envelope.body;
    if (body.nationId !== nationId) return [];
    return [
      {
        techId: body.techId,
        previousPoints: Number(body.previousPoints),
        newPoints: Number(body.newPoints),
      },
    ];
  });
}

export function discoveriesFromEvents(
  events: readonly DomainEventEnvelope[],
  nationId: string,
): readonly MonthlyReportDiscovery[] {
  return events.flatMap((envelope) => {
    if (envelope.body.kind !== "TechnologyDiscovered") return [];
    const body = envelope.body;
    if (body.nationId !== nationId) return [];
    return [{ techId: body.techId, researchFieldId: body.researchFieldId }];
  });
}

export function activeShipCount(nation: FleetSnapshot): number {
  return nation.fleets.flatMap((fleet) => fleet.ships).filter((ship) => !ship.isUnderConstruction)
    .length;
}

export interface MonthlyReportEntryInput {
  readonly response: CommitMonthResponse;
  readonly month: { readonly year: number; readonly month: number };
  readonly nextMonth: { readonly year: number; readonly month: number };
  readonly turn: number;
  readonly reportId: string;
  readonly generatedAt: string;
  readonly campaignId: string;
  readonly playerNationId: string;
  readonly playerNationBefore: NationState;
  readonly playerNationAfter: NationState;
  readonly postSnapshot: CampaignSnapshot;
  readonly ledgerEntries: readonly LedgerTransaction[];
  readonly domainEvents: readonly DomainEventEnvelope[];
}

export function buildMonthlyReportEntry(input: MonthlyReportEntryInput): MonthlyReportEntry {
  const { response, playerNationId, playerNationBefore, playerNationAfter, postSnapshot } = input;

  const researchExpense = sumByCategory(input.ledgerEntries, ["RESEARCH_EXPENDITURE"]);
  const governmentAllocation = sumByCategory(input.ledgerEntries, ["NAVAL_APPROPRIATION"]);
  const ships = completedShips(playerNationBefore, playerNationAfter);
  const reconciliation = reconcileMonthLedger(
    input.ledgerEntries.map((entry) => ({
      categoryId: entry.categoryId,
      debit: Number(entry.debit),
      credit: Number(entry.credit),
    })),
    response.report.openingTreasury,
    response.report.closingTreasury,
  );

  return {
    reportId: input.reportId,
    campaignId: input.campaignId,
    turn: input.turn,
    period: { from: { ...input.month }, to: { ...input.nextMonth } },
    generatedAt: input.generatedAt,
    treasury: {
      openingTreasury: response.report.openingTreasury,
      closingTreasury: response.report.closingTreasury,
      maintenanceCost: response.report.maintenanceCost,
      constructionSpending: response.report.newConstructionSpending,
      researchExpense,
      governmentAllocation,
      netChange: response.report.closingTreasury - response.report.openingTreasury,
      ledgerRows: response.financialLedger.map((entry) => ({
        id: entry.id,
        description: entry.description,
        phase: entry.phase,
        amount: entry.amount,
        runningBalance: entry.runningBalance,
        ...(entry.requested === undefined
          ? {}
          : { requested: entry.requested, shortfall: entry.shortfall ?? 0 }),
      })),
      obligationExpense: sumByCategory(input.ledgerEntries, ["OBLIGATION"]),
      reconciliation,
      treasuryExplanation: explainReportTreasury(reconciliation),
    },
    construction: {
      projects: constructionProgressFromEvents(input.domainEvents, playerNationId),
      completedShips: ships,
      newlyActiveProjectIds: newlyActiveProjectIds(playerNationBefore, playerNationAfter),
    },
    research: {
      progress: researchProgressFromEvents(input.domainEvents, playerNationId),
      discoveries: discoveriesFromEvents(input.domainEvents, playerNationId),
    },
    fleet: {
      additions: ships,
      totalActiveShips: activeShipCount(playerNationAfter),
    },
    priorities: [...buildPrioritiesProjection(postSnapshot, playerNationId)],
    battleOutcomes: response.closingSnapshot.battleOutcomes.map((outcome) => ({
      battleId: outcome.battleId,
      areaId: outcome.areaId,
      attackerId: outcome.attackerId,
      defenderId: outcome.defenderId,
      winnerId: outcome.winnerId,
      loserId: outcome.loserId,
      warScoreDelta: outcome.warScoreDelta,
      attackerLosses: [...outcome.attackerLosses],
      defenderLosses: [...outcome.defenderLosses],
      explanation: [...outcome.explanation],
    })),
  };
}
