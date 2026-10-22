import type {
  EconomyStatus,
  PlayerProjection,
  ResearchUnfundedReason,
} from "@bluewave/campaign-engine";

export interface TreasuryBreakdown {
  readonly income: number;
  readonly obligations: number;
  readonly fleetMaintenance: number;
  readonly researchSpend: number;
  readonly researchRequested: number;
  readonly researchCap: number;
  readonly researchUnfundedReason: ResearchUnfundedReason | undefined;
  readonly plannedConstruction: number;
  readonly totalExpenditure: number;
  readonly projectedSurplusDeficit: number;
  readonly status: EconomyStatus;
  readonly shortfall: number;
  readonly availableFunds: number;
  readonly projectedMonthEndFunds: number;
  readonly runwayMonths: number | undefined;
}

export function summarizeTreasury(projection: PlayerProjection): TreasuryBreakdown {
  const economy = projection.economy;
  return {
    income: economy.monthlyAppropriation,
    obligations: economy.obligations,
    fleetMaintenance: economy.maintenanceCost,
    researchSpend: economy.researchSpend,
    researchRequested: economy.researchRequested,
    researchCap: economy.researchCap,
    researchUnfundedReason: economy.researchUnfundedReason,
    plannedConstruction: economy.plannedConstruction,
    totalExpenditure: economy.obligations + economy.maintenanceCost + economy.researchSpend,
    projectedSurplusDeficit: projection.projectedSurplusDeficit,
    status: economy.status,
    shortfall: economy.shortfall,
    availableFunds: economy.treasury,
    projectedMonthEndFunds: economy.monthEndTreasury,
    runwayMonths: economy.runwayMonths,
  };
}
