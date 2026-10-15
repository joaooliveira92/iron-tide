import {
  ConstructionPlanError,
  historicalBuildMonths,
  planConstruction,
  simulateConstruction,
  type ConstructionBalance,
  type ConstructionPlan,
  type ConstructionSchedule,
  type LineId,
} from "./construction.js";
import { capacityInUnits, scalePlanToUnits } from "./constructionProgress.js";
import type { CompiledDesign, DesignDraft } from "./compile.js";
import type { CostBreakdown } from "./cost.js";
import { yardFits, type Yard, type YardDemand } from "./yards.js";

/** The hull measurements a yard must accommodate, read from a compiled design. */
export function yardDemandOf(c: CompiledDesign, d: DesignDraft): YardDemand {
  return {
    lengthMm: d.hull.lengthWl,
    beamMm: d.hull.beam,
    displacementKg: c.totalKg,
    heaviestKg: Math.max(0, ...c.components.map((x) => x.weightKg)),
  };
}

export interface YardChoice {
  /** Yards that can hold the hull, in the order given (ascending capacity). */
  readonly fitting: readonly Yard[];
  /** Historical keel-to-commissioning months for this displacement (industry and acceleration applied). */
  readonly historicalMonths: number;
  /** Months to finish at each fitting yard (max of historical and the capacity schedule); null when it cannot finish in time. */
  readonly monthsByYard: ReadonlyMap<string, number | null>;
  /** The yard with the shortest finish time, the smallest on a tie; null when none can build the hull. */
  readonly best: {
    readonly yard: Yard;
    readonly schedule: ConstructionSchedule;
    readonly months: number;
  } | null;
}

export interface YardChoiceOptions {
  /** Keel-laying month (`YYYY-MM`) for the era multiplier on the historical build time. */
  readonly month?: string | undefined;
  readonly industryBp?: number | undefined;
  readonly accelerated?: boolean | undefined;
}

/**
 * Which yard builds a design: of the yards that can hold the hull, the one whose capacity schedule (never faster than the
 * historical build time) finishes soonest; on a tie the smallest, because yards are given in ascending capacity. The single
 * rule behind both the Drawing Board forecast and the engine's order, so they cannot disagree. Pure.
 */
export function chooseYard(
  plan: ConstructionPlan,
  demand: YardDemand,
  yards: readonly Yard[],
  balance: ConstructionBalance,
  displacementKg: number,
  options: YardChoiceOptions = {},
): YardChoice {
  const fitting = yards.filter((y) => yardFits(y.facility, demand));
  const historicalMonths = historicalBuildMonths(displacementKg, balance, {
    month: options.month,
    industryBp: options.industryBp,
    accelerated: options.accelerated,
  });
  const monthsByYard = new Map<string, number | null>();
  let best: YardChoice["best"] = null;
  for (const yard of fitting) {
    monthsByYard.set(yard.facility.id, null);
    try {
      const schedule = simulateConstruction(
        plan,
        { capacity: yard.capacity, monthlyFundingMicro: null, costPerWorkMicro: 1 },
        balance.maxMonths,
      );
      const months = Math.max(historicalMonths, schedule.durationMonths);
      monthsByYard.set(yard.facility.id, months);
      // Yards are ascending in capacity, so a strict improvement keeps the smallest yard on a tie.
      if (best === null || months < best.months) best = { yard, schedule, months };
    } catch (e) {
      if (!ConstructionPlanError.is(e) || e.code !== "CONSTRUCTION_STALLED") throw e;
    }
  }
  return { fitting, historicalMonths, monthsByYard, best };
}

/** What an order stores on its project: the plan in treasury units, the yard, and that yard's monthly capacity in the same units. */
export interface ConstructionOrderPlan {
  readonly packages: ConstructionPlan["packages"];
  readonly yardId: string;
  readonly capacityUnits: Readonly<Record<LineId, number>>;
}

export interface OrderPlanInput {
  readonly compiled: CompiledDesign;
  readonly draft: DesignDraft;
  readonly cost: CostBreakdown;
  readonly balance: ConstructionBalance;
  readonly yards: readonly Yard[];
  /** Keel-laying month (`YYYY-MM`) for the era multiplier on the historical build time. */
  readonly month?: string | undefined;
  readonly industryBp?: number | undefined;
  readonly accelerated?: boolean | undefined;
}

/**
 * The construction plan an order carries (ADR-0077): the design's work packages scaled onto `totalUnits` treasury units, the
 * yard chosen by `chooseYard`, and that yard's per-line capacity converted to the same units. Null when no yard can build the
 * hull, in which case the order keeps the single-figure model. Pure and deterministic; plans as first of class, like the
 * forecast.
 */
export function constructionOrderPlan(
  input: OrderPlanInput,
  totalUnits: number,
): ConstructionOrderPlan | null {
  const { compiled, draft, cost, balance, yards } = input;
  const plan = planConstruction(compiled, draft, cost, balance, true);
  const choice = chooseYard(
    plan,
    yardDemandOf(compiled, draft),
    yards,
    balance,
    compiled.totalKg,
    input,
  );
  if (choice.best === null) return null;
  return {
    packages: scalePlanToUnits(plan, totalUnits).packages,
    yardId: choice.best.yard.facility.id,
    capacityUnits: capacityInUnits(choice.best.yard.capacity, plan, totalUnits),
  };
}
