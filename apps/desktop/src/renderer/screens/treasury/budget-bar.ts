import type { TreasuryBreakdown } from "./treasury-summary.js";
import { formatCount } from "../../lib/presentation-format/index.js";

export type BudgetSegmentId = "obligations" | "maintenance" | "research";

interface BudgetSegmentSpec {
  readonly id: BudgetSegmentId;
  readonly label: string;
  /** Tailwind background token for the segment swatch and its bar block. */
  readonly className: string;
  /** Reads this segment's value out of a treasury breakdown. */
  readonly valueOf: (breakdown: TreasuryBreakdown) => number;
}

/**
 * The single source of truth for the budget bar's segments — identity, order,
 * label, colour, and where the value comes from. Adding or reordering a
 * category is one entry here; neither the geometry nor the view needs to change.
 */
export const BUDGET_SEGMENTS: readonly BudgetSegmentSpec[] = [
  {
    id: "obligations",
    label: "Obligations",
    className: "bg-warning",
    valueOf: (breakdown) => breakdown.obligations,
  },
  {
    id: "maintenance",
    label: "Fleet maintenance",
    className: "bg-primary",
    valueOf: (breakdown) => breakdown.fleetMaintenance,
  },
  {
    id: "research",
    label: "Research",
    className: "bg-success",
    valueOf: (breakdown) => breakdown.researchSpend,
  },
];

export interface BudgetSegment {
  readonly id: BudgetSegmentId;
  readonly label: string;
  readonly className: string;
  readonly value: number;
  /** Share of the bar's full width, 0..1. */
  readonly width: number;
  /** Share of total expenditure, 0..1 (0 when nothing is spent). */
  readonly shareOfSpend: number;
}

export interface BudgetBar {
  readonly income: number;
  readonly totalExpenditure: number;
  readonly segments: readonly BudgetSegment[];
  /** Where income falls along the bar, 0..1 — spending past this line is a deficit. */
  readonly incomeMarker: number;
  readonly overBudget: boolean;
  /** Amount spending exceeds income by, 0 when within income. */
  readonly overBudgetBy: number;
  /** Accessible, self-describing summary of the whole bar. */
  readonly label: string;
}

/**
 * Geometry for the "budget at a glance" bar (spec V-4): expenditure stacked in
 * segments against an income marker, on one shared scale (whichever is larger),
 * so over-spending is visible as the bar running past the marker. The stack is the committed monthly flows (obligations,
 * maintenance, research); construction is an "up to" bound limited by yards, not a commitment, and is not in it.
 * Presentation only — every figure comes from `summarizeTreasury`.
 */
export function buildBudgetBar(breakdown: TreasuryBreakdown): BudgetBar {
  const income = Math.max(0, breakdown.income);
  const spend = breakdown.totalExpenditure;
  const scale = Math.max(income, spend, 1);
  const segments: BudgetSegment[] = BUDGET_SEGMENTS.map((spec) => {
    const value = spec.valueOf(breakdown);
    return {
      id: spec.id,
      label: spec.label,
      className: spec.className,
      value,
      width: Math.max(0, value) / scale,
      shareOfSpend: spend > 0 ? Math.max(0, value) / spend : 0,
    };
  });
  const overBudget = spend > income;
  const spent = segments
    .map((segment) => `${segment.label} ${formatCount(segment.value)}`)
    .join(", ");
  return {
    income,
    totalExpenditure: spend,
    segments,
    incomeMarker: income / scale,
    overBudget,
    overBudgetBy: Math.max(0, spend - income),
    label: `Monthly budget: income ${formatCount(income)}; expenditure ${formatCount(spend)} (${spent}). ${
      overBudget ? "Spending exceeds income." : "Spending is within income."
    }`,
  };
}
