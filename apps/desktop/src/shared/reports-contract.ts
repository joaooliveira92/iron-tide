import type {
  BattleOutcome,
  LedgerReconciliation,
  StrategicPriority,
} from "@bluewave/campaign-engine";
import type { ExplanationTree } from "@bluewave/events";

export interface MonthlyReportLedgerRow {
  readonly id: string;
  readonly description: string;
  readonly phase: string;
  readonly amount: number;
  readonly runningBalance: number;
  readonly requested?: number;
  readonly shortfall?: number;
}

export interface MonthlyReportTreasury {
  readonly openingTreasury: number;
  readonly closingTreasury: number;
  readonly maintenanceCost: number;
  readonly constructionSpending: number;
  readonly researchExpense: number;
  readonly governmentAllocation: number;
  readonly netChange: number;
  readonly ledgerRows: readonly MonthlyReportLedgerRow[];
  readonly obligationExpense?: number;
  readonly reconciliation?: LedgerReconciliation;
  readonly treasuryExplanation?: ExplanationTree;
}

export interface MonthlyReportConstructionProgress {
  readonly projectId: string;
  readonly previousWork: number;
  readonly newWork: number;
}

export interface MonthlyReportShip {
  readonly shipId: string;
  readonly name: string;
}

export interface MonthlyReportConstruction {
  readonly projects: readonly MonthlyReportConstructionProgress[];
  readonly completedShips: readonly MonthlyReportShip[];
  readonly newlyActiveProjectIds: readonly string[];
}

export interface MonthlyReportResearchProgress {
  readonly techId: string;
  readonly previousPoints: number;
  readonly newPoints: number;
}

export interface MonthlyReportDiscovery {
  readonly techId: string;
  readonly researchFieldId: string;
}

export interface MonthlyReportResearch {
  readonly progress: readonly MonthlyReportResearchProgress[];
  readonly discoveries: readonly MonthlyReportDiscovery[];
}

export interface MonthlyReportFleet {
  readonly additions: readonly MonthlyReportShip[];
  readonly totalActiveShips: number;
}

export interface MonthlyReportPeriod {
  readonly from: { readonly year: number; readonly month: number };
  readonly to: { readonly year: number; readonly month: number };
}

export interface MonthlyReportEntry {
  readonly reportId: string;
  readonly campaignId: string;
  readonly turn: number;
  readonly period: MonthlyReportPeriod;
  readonly generatedAt: string;
  readonly treasury: MonthlyReportTreasury;
  readonly construction: MonthlyReportConstruction;
  readonly research: MonthlyReportResearch;
  readonly fleet: MonthlyReportFleet;
  readonly priorities: readonly StrategicPriority[];
  readonly battleOutcomes: readonly BattleOutcome[];
}

export interface MonthlyReports {
  readonly reports: readonly MonthlyReportEntry[];
}

export interface ReadMonthlyReportsResult {
  readonly reports: readonly MonthlyReportEntry[];
}
