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
  MonthlyReportExerciseTension,
  MonthlyReportFleetExercise,
  MonthlyReportPresence,
  MonthlyReportPresenceShortfall,
  MonthlyReportResearchProgress,
  MonthlyReportShip,
  MonthlyReportUnrest,
  MonthlyReportUnrestChange,
  MonthlyReportUnrestConsequence,
} from "../../../shared/reports-contract.js";
import { neutralWarsFromEvents } from "./neutralWarReport.js";
import { foreignRevolutionsFromEvents } from "./revolutionReport.js";
import { tradeProtectionFromEvents } from "./tradeProtectionReport.js";
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

export function shipNameLookup(
  ...states: readonly FleetSnapshot[]
): (shipId: string) => string | undefined {
  const names = new Map<string, string>();
  for (const state of states) {
    for (const fleet of state.fleets) {
      for (const ship of fleet.ships) names.set(ship.id, ship.name);
    }
  }
  return (shipId) => names.get(shipId);
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

export function presenceFromEvents(
  events: readonly DomainEventEnvelope[],
  nationId: string,
): MonthlyReportPresence | undefined {
  const shortfalls: MonthlyReportPresenceShortfall[] = [];
  let prestigeDelta: number | undefined;
  for (const envelope of events) {
    const body = envelope.body;
    if (body.kind === "PresenceShortfall") {
      if (body.nationId !== nationId) continue;
      shortfalls.push({
        areaId: body.areaId,
        requiredTons: Number(body.requiredTons),
        presentTons: Number(body.presentTons),
        shortfallTons: Number(body.shortfallTons),
      });
    } else if (
      body.kind === "PrestigeChanged" &&
      body.nationId === nationId &&
      body.reasonCode === "PRESENCE_SHORTFALL"
    ) {
      prestigeDelta = (prestigeDelta ?? 0) + Number(body.delta);
    }
  }
  if (shortfalls.length === 0) return undefined;
  return { shortfalls, ...(prestigeDelta === undefined ? {} : { prestigeDelta }) };
}

export function fleetExerciseFromEvents(
  events: readonly DomainEventEnvelope[],
  nationId: string,
): MonthlyReportFleetExercise | undefined {
  let scheduled: MonthlyReportFleetExercise["scheduled"];
  let completed: MonthlyReportFleetExercise["completed"];
  const tension: MonthlyReportExerciseTension[] = [];
  for (const { body } of events) {
    if (body.kind === "FleetExerciseScheduled" && body.nationId === nationId) {
      scheduled = { month: body.month, shipIds: [...body.shipIds] };
    } else if (body.kind === "FleetExerciseCompleted" && body.nationId === nationId) {
      completed = {
        month: body.month,
        shipIds: [...body.shipIds],
        experienceGained: Number(body.experienceGained),
      };
    } else if (body.kind === "ExerciseTensionRaised" && body.nationId === nationId) {
      tension.push({
        otherNationId: body.otherNationId,
        before: Number(body.before),
        after: Number(body.after),
      });
    }
  }
  if (scheduled === undefined && completed === undefined && tension.length === 0) return undefined;
  tension.sort((a, b) =>
    a.otherNationId < b.otherNationId ? -1 : a.otherNationId > b.otherNationId ? 1 : 0,
  );
  return {
    ...(scheduled === undefined ? {} : { scheduled }),
    ...(completed === undefined ? {} : { completed }),
    tension,
  };
}

export function unrestFromEvents(
  events: readonly DomainEventEnvelope[],
  nationId: string,
): MonthlyReportUnrest | undefined {
  const changes: MonthlyReportUnrestChange[] = [];
  const consequences: MonthlyReportUnrestConsequence[] = [];
  let before: number | undefined;
  let after = 0;
  for (const { body } of events) {
    if (body.kind === "UnrestChanged" && body.nationId === nationId) {
      before ??= Number(body.before);
      after = Number(body.after);
      changes.push({ reasonCode: body.reasonCode, delta: Number(body.delta) });
    } else if (body.kind === "UnrestConsequence" && body.nationId === nationId) {
      consequences.push({ consequence: body.consequence, careerEnded: body.careerEnded });
    }
  }
  if (before === undefined) return undefined;
  return { before, after, changes, consequences };
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

  const presence = presenceFromEvents(input.domainEvents, playerNationId);
  const fleetExercise = fleetExerciseFromEvents(input.domainEvents, playerNationId);
  const tradeProtection = tradeProtectionFromEvents(
    input.domainEvents,
    playerNationId,
    shipNameLookup(playerNationBefore, playerNationAfter),
  );
  const unrest = unrestFromEvents(input.domainEvents, playerNationId);
  const foreignRevolutions = foreignRevolutionsFromEvents(input.domainEvents, playerNationId);
  const neutralWars = neutralWarsFromEvents(input.domainEvents, playerNationId);

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
    ...(presence === undefined ? {} : { presence }),
    ...(fleetExercise === undefined ? {} : { fleetExercise }),
    ...(tradeProtection === undefined ? {} : { tradeProtection }),
    ...(unrest === undefined ? {} : { unrest }),
    ...(foreignRevolutions.length === 0 ? {} : { foreignRevolutions }),
    ...(neutralWars.length === 0 ? {} : { neutralWars }),
  };
}
