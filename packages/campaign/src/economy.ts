import { SafeInt } from "@bluewave/contracts";
import { APPROPRIATION_RATE_MAX_BP } from "./budgetConstants.js";

export const ECONOMY_RATE_DENOMINATOR = 120_000;
export const START_APPROPRIATION_RATE_BP = 2000;
export const MAX_APPROPRIATION_RATE_BP = APPROPRIATION_RATE_MAX_BP;
export const RESEARCH_SHARE_CAP_BP = 1200;

export const MAX_ECONOMIC_BASE = Math.floor(Number.MAX_SAFE_INTEGER / MAX_APPROPRIATION_RATE_BP);

export function deriveEconomicBase(income: SafeInt, startRateBp: SafeInt): SafeInt {
  const numerator = SafeInt.mul(income, SafeInt(ECONOMY_RATE_DENOMINATOR));
  return SafeInt.div(numerator, startRateBp, "ceil");
}

export function monthlyRevenue(base: SafeInt, rateBp: SafeInt): SafeInt {
  return SafeInt.div(SafeInt.mul(base, rateBp), SafeInt(ECONOMY_RATE_DENOMINATOR), "floor");
}

export function researchCap(revenue: SafeInt): SafeInt {
  return SafeInt.div(
    SafeInt.mul(revenue, SafeInt(RESEARCH_SHARE_CAP_BP)),
    SafeInt(10_000),
    "floor",
  );
}

export function monthlyResearchSpend(annual: SafeInt): SafeInt {
  return SafeInt.div(annual, SafeInt(12), "floor");
}

export interface OutflowSettlement {
  readonly requested: SafeInt;
  readonly paid: SafeInt;
  readonly shortfall: SafeInt;
}

export function settleOutflow(requested: SafeInt, available: SafeInt): OutflowSettlement {
  const spendable = (available as number) > 0 ? available : SafeInt.ZERO;
  const paid = requested < spendable ? requested : spendable;
  return { requested, paid, shortfall: SafeInt.sub(requested, paid) };
}

export interface MonthlyFlows {
  readonly revenue: SafeInt;
  readonly obligations: SafeInt;
  readonly maintenance: SafeInt;
  readonly research: SafeInt;
}

export function monthlyNetBeforeConstruction(flows: MonthlyFlows): SafeInt {
  const outflow = SafeInt.add(SafeInt.add(flows.obligations, flows.maintenance), flows.research);
  return SafeInt.sub(flows.revenue, outflow);
}

export function runwayMonths(treasury: SafeInt, net: SafeInt): number | undefined {
  if ((net as number) >= 0) return undefined;
  return Math.floor((treasury as number) / -(net as number));
}

export function incomeFitsEconomicBase(income: SafeInt): boolean {
  return (
    (income as number) <=
    Math.floor((MAX_ECONOMIC_BASE * START_APPROPRIATION_RATE_BP) / ECONOMY_RATE_DENOMINATOR)
  );
}

export const GROWTH_BAND_MIN_BP = 300;
export const GROWTH_BAND_MAX_BP = 500;

export function isGrowthRateInBand(annualGrowthBp: number): boolean {
  return (
    Number.isSafeInteger(annualGrowthBp) &&
    annualGrowthBp >= GROWTH_BAND_MIN_BP &&
    annualGrowthBp <= GROWTH_BAND_MAX_BP
  );
}

export function monthlyBaseGrowth(base: SafeInt, annualGrowthBp: number): SafeInt {
  if (!isGrowthRateInBand(annualGrowthBp))
    throw new RangeError(
      `annualGrowthBp must be an integer in ${String(GROWTH_BAND_MIN_BP)}..${String(GROWTH_BAND_MAX_BP)}, got ${String(annualGrowthBp)}`,
    );
  return SafeInt.div(
    SafeInt.mul(base, SafeInt(annualGrowthBp)),
    SafeInt(ECONOMY_RATE_DENOMINATOR),
    "floor",
  );
}

export function grownBase(base: SafeInt, annualGrowthBp: number): SafeInt {
  const next = SafeInt.add(base, monthlyBaseGrowth(base, annualGrowthBp));
  return (next as number) > MAX_ECONOMIC_BASE ? SafeInt(MAX_ECONOMIC_BASE) : next;
}
