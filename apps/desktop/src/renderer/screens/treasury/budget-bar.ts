import type { TreasuryBreakdown } from "./treasury-summary.js";
import { formatCount } from "../../lib/presentation-format/index.js";

export type BudgetSegmentId = "obligations" | "maintenance" | "research";

interface BudgetSegmentSpec {
  readonly id: BudgetSegmentId;
  readonly label: string;
  readonly className: string;
  readonly valueOf: (breakdown: TreasuryBreakdown) => number;
}

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
  readonly width: number;
  readonly shareOfSpend: number;
}

export interface BudgetBar {
  readonly income: number;
  readonly totalExpenditure: number;
  readonly segments: readonly BudgetSegment[];
  readonly incomeMarker: number;
  readonly overBudget: boolean;
  readonly overBudgetBy: number;
  readonly label: string;
}

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
