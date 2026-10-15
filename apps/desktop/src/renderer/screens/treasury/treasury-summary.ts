import type { PlayerProjection } from "@bluewave/campaign-engine";

export interface TreasuryBreakdown {
  readonly income: number;
  readonly fleetMaintenance: number;
  readonly constructionSpend: number;
  readonly researchSpend: number;
  readonly totalExpenditure: number;
  readonly projectedSurplusDeficit: number;
  readonly availableFunds: number;
  readonly projectedMonthEndFunds: number;
}

/**
 * Pure read-only Treasury summary, every figure from the `inspectCampaign`
 * projection (spec §9). Nothing is computed in the renderer except the two
 * presentation sums: total expenditure and projected month-end funds (both
 * sums of projection numbers). Surplus/deficit may legitimately be negative.
 */
export function summarizeTreasury(projection: PlayerProjection): TreasuryBreakdown {
  const income = projection.economy.monthlyAppropriation;
  const fleetMaintenance = projection.economy.maintenanceCost;
  const constructionSpend = projection.economy.constructionSpend;
  const researchSpend = projection.economy.researchSpend;
  const totalExpenditure = fleetMaintenance + constructionSpend + researchSpend;
  const projectedSurplusDeficit = projection.projectedSurplusDeficit;
  const availableFunds = projection.economy.treasury;
  const projectedMonthEndFunds = availableFunds + projectedSurplusDeficit;
  return {
    income,
    fleetMaintenance,
    constructionSpend,
    researchSpend,
    totalExpenditure,
    projectedSurplusDeficit,
    availableFunds,
    projectedMonthEndFunds,
  };
}
