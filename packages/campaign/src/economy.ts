// Economy calculators (spec #138, slice 1): the single home of every campaign-economy formula. The phase engine and every
// projection call these, so no formula is implemented twice. Units: 1 treasury unit = £10,000. Pure, integer-only,
// checked arithmetic, one rounding point per formula.
import { SafeInt } from "@bluewave/contracts";
import { APPROPRIATION_RATE_MAX_BP } from "./budgetConstants.js";

/** Annual rate in basis points x twelve months: `base x rateBp / 120000` is the monthly revenue. */
export const ECONOMY_RATE_DENOMINATOR = 120_000;
/** The appropriation rate every nation starts at (basis points of the annual base). */
export const START_APPROPRIATION_RATE_BP = 2000;
export const MAX_APPROPRIATION_RATE_BP = APPROPRIATION_RATE_MAX_BP;
/** Research may take at most this share of monthly revenue (basis points). */
export const RESEARCH_SHARE_CAP_BP = 1200;

/** The largest base whose revenue product stays a safe integer at the maximum validated rate. */
export const MAX_ECONOMIC_BASE = Math.floor(Number.MAX_SAFE_INTEGER / MAX_APPROPRIATION_RATE_BP);

/** The derived annual economic base: `ceil(income x 120000 / startRateBp)`. Throws on overflow (callers diagnose first). */
export function deriveEconomicBase(income: SafeInt, startRateBp: SafeInt): SafeInt {
  const numerator = SafeInt.mul(income, SafeInt(ECONOMY_RATE_DENOMINATOR));
  return SafeInt.div(numerator, startRateBp, "ceil");
}

/** Monthly revenue: `floor(base x rateBp / 120000)` — the only rounding point; the remainder is dropped. */
export function monthlyRevenue(base: SafeInt, rateBp: SafeInt): SafeInt {
  return SafeInt.div(SafeInt.mul(base, rateBp), SafeInt(ECONOMY_RATE_DENOMINATOR), "floor");
}

/** The most a nation may spend on research in a month: `floor(12% x monthly revenue)`. */
export function researchCap(revenue: SafeInt): SafeInt {
  return SafeInt.div(
    SafeInt.mul(revenue, SafeInt(RESEARCH_SHARE_CAP_BP)),
    SafeInt(10_000),
    "floor",
  );
}

/** The standing monthly research spend of an annual authored allocation: `floor(annual / 12)`. */
export function monthlyResearchSpend(annual: SafeInt): SafeInt {
  return SafeInt.div(annual, SafeInt(12), "floor");
}

/** One outflow as the ledger records it; the reconciliation identity holds on `paid`. */
export interface OutflowSettlement {
  readonly requested: SafeInt;
  readonly paid: SafeInt;
  readonly shortfall: SafeInt;
}

/** Pay what the available funds allow; the unpaid remainder is a recorded, non-carried shortfall. */
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

/** The monthly net before construction: revenue less obligations, maintenance and research. */
export function monthlyNetBeforeConstruction(flows: MonthlyFlows): SafeInt {
  const outflow = SafeInt.add(SafeInt.add(flows.obligations, flows.maintenance), flows.research);
  return SafeInt.sub(flows.revenue, outflow);
}

/** Whole months the treasury lasts at a negative net, or undefined when the net is not negative. */
export function runwayMonths(treasury: SafeInt, net: SafeInt): number | undefined {
  if ((net as number) >= 0) return undefined;
  return Math.floor((treasury as number) / -(net as number));
}

/** Whether `income` derives a base whose revenue product stays a safe integer (no float product, so exact). */
export function incomeFitsEconomicBase(income: SafeInt): boolean {
  return (
    (income as number) <=
    Math.floor((MAX_ECONOMIC_BASE * START_APPROPRIATION_RATE_BP) / ECONOMY_RATE_DENOMINATOR)
  );
}
