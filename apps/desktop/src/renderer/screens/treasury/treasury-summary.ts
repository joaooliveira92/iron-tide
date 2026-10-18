import type {
  EconomyStatus,
  PlayerProjection,
  ResearchUnfundedReason,
} from "@bluewave/campaign-engine";

export interface TreasuryBreakdown {
  readonly income: number;
  readonly obligations: number;
  readonly fleetMaintenance: number;
  /** Research the engine will pay next month (0 when no field can take the standing budget). */
  readonly researchSpend: number;
  /** The standing research budget as set, paid or not. */
  readonly researchRequested: number;
  readonly researchCap: number;
  readonly researchUnfundedReason: ResearchUnfundedReason | undefined;
  /** An upper bound on construction work next month; limited by yards and then by the treasury. */
  readonly plannedConstruction: number;
  /** Committed monthly flows: obligations + maintenance + planned research. */
  readonly totalExpenditure: number;
  /** Net before construction. */
  readonly projectedSurplusDeficit: number;
  readonly status: EconomyStatus;
  /** Unpaid obligations, maintenance and research next month, at the construction upper bound. */
  readonly shortfall: number;
  readonly availableFunds: number;
  readonly projectedMonthEndFunds: number;
  readonly runwayMonths: number | undefined;
}

/**
 * Pure read-only Treasury summary, every figure from the `inspectCampaign` projection (spec §9, #138). Nothing is computed in
 * the renderer except the presentation sum of the committed monthly flows. Surplus/deficit may legitimately be negative, and
 * the month-end funds are the engine's own figure at the construction upper bound (never negative: a shortfall is not carried).
 */
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
