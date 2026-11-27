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

export interface MonthlyReportPresenceShortfall {
  readonly areaId: string;
  readonly requiredTons: number;
  readonly presentTons: number;
  readonly shortfallTons: number;
}

export interface MonthlyReportPresence {
  readonly shortfalls: readonly MonthlyReportPresenceShortfall[];
  readonly prestigeDelta?: number;
}

export interface MonthlyReportExerciseTension {
  readonly otherNationId: string;
  readonly before: number;
  readonly after: number;
}

export interface MonthlyReportFleetExercise {
  readonly scheduled?: { readonly month: string; readonly shipIds: readonly string[] };
  readonly completed?: {
    readonly month: string;
    readonly shipIds: readonly string[];
    readonly experienceGained: number;
  };
  readonly tension: readonly MonthlyReportExerciseTension[];
}

export interface MonthlyReportTradeProtection {
  readonly quota: number;
  readonly assigned: number;
  readonly shortfall: number;
  readonly shortfallBp: number;
  readonly submarineExplanation?: ExplanationTree;
  readonly loss?: {
    readonly raiderHits: number;
    readonly submarineHits?: number;
    readonly pressureHit: boolean;
    readonly lossBp: number;
    readonly poolBefore: number;
    readonly poolAfter: number;
  };
  readonly raiders?: readonly MonthlyReportRaiderEntry[];
  readonly warshipAttacks?: readonly MonthlyReportWarshipAttackEntry[];
}

export interface MonthlyReportWarshipAttackEntry {
  readonly shipId: string;
  readonly shipName?: string;
  readonly attackerNationId: string;
  readonly areaId: string;
  readonly outcome: "SUNK" | "DAMAGED";
  readonly damageBp: number;
}

export interface MonthlyReportRaiderEntry {
  readonly shipId: string;
  readonly shipName?: string;
  readonly event: "ENGAGED" | "INTERNED" | "RELEASED";
  readonly encounter?: "INTERCEPTION" | "BREAKOUT";
  readonly victimNationId?: string;
  readonly outcome?: "SURVIVED" | "SUNK" | "SCUTTLED" | "INTERNED";
  readonly cause?: "FUEL_EXHAUSTION" | "BREAKDOWN" | "DAMAGE";
}

export interface MonthlyReportNeutralWar {
  readonly role: "DECLARER" | "TARGET";
  readonly otherNationId: string;
  readonly warId: string;
  readonly cause: "UNRESTRICTED_SUBMARINE_INCIDENTS";
  readonly tension: number;
}

export interface MonthlyReportRevolution {
  readonly nationId: string;
  readonly governmentBefore: string;
  readonly governmentAfter: string;
}

export interface MonthlyReportUnrestChange {
  readonly reasonCode: string;
  readonly delta: number;
}

export interface MonthlyReportUnrestConsequence {
  readonly consequence: "STRIKE" | "REVOLUTION";
  readonly careerEnded: boolean;
}

export interface MonthlyReportUnrest {
  readonly before: number;
  readonly after: number;
  readonly changes: readonly MonthlyReportUnrestChange[];
  readonly consequences: readonly MonthlyReportUnrestConsequence[];
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
  readonly presence?: MonthlyReportPresence;
  readonly fleetExercise?: MonthlyReportFleetExercise;
  readonly tradeProtection?: MonthlyReportTradeProtection;
  readonly unrest?: MonthlyReportUnrest;
  readonly foreignRevolutions?: readonly MonthlyReportRevolution[];
  readonly neutralWars?: readonly MonthlyReportNeutralWar[];
}

export interface MonthlyReports {
  readonly reports: readonly MonthlyReportEntry[];
}

export interface ReadMonthlyReportsResult {
  readonly reports: readonly MonthlyReportEntry[];
}
