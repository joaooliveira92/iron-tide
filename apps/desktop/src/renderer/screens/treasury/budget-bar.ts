import type { TreasuryBreakdown } from "./treasury-summary.js";
import { formatCount } from "../../lib/presentation-format/format.js";

export type BudgetSegmentId = "obligations" | "maintenance" | "research";

interface BudgetSegmentSpec {
  readonly id: BudgetSegmentId;
  readonly label: string;
  readonly className: string;
  readonly textClassName: string;
  readonly description: string;
  readonly valueOf: (breakdown: TreasuryBreakdown) => number;
}

export const BUDGET_SEGMENTS: readonly BudgetSegmentSpec[] = [
  {
    id: "obligations",
    label: "Obligations",
    className: "bg-warning",
    textClassName: "text-warning",
    description: "Standing commitments paid before anything else each month.",
    valueOf: (breakdown) => breakdown.obligations,
  },
  {
    id: "maintenance",
    label: "Fleet maintenance",
    className: "bg-primary",
    textClassName: "text-primary",
    description: "Upkeep for every ship in the fleet, paid monthly whether it sails or not.",
    valueOf: (breakdown) => breakdown.fleetMaintenance,
  },
  {
    id: "research",
    label: "Research",
    className: "bg-success",
    textClassName: "text-success",
    description:
      "Funds the research projects you have queued, up to the cap for your appropriation rate.",
    valueOf: (breakdown) => breakdown.researchSpend,
  },
];

export interface BudgetSegment {
  readonly id: BudgetSegmentId;
  readonly label: string;
  readonly className: string;
  readonly textClassName: string;
  readonly description: string;
  readonly value: number;
  readonly width: number;
  readonly shareOfSpend: number;
  readonly shareOfIncome: number;
  readonly previewWidth: number;
  readonly previewDelta: number;
}

export interface BudgetBar {
  readonly income: number;
  readonly totalExpenditure: number;
  readonly segments: readonly BudgetSegment[];
  readonly incomeMarker: number;
  readonly scale: number;
  readonly overBudget: boolean;
  readonly overBudgetBy: number;
  readonly label: string;
}

export function buildBudgetBar(
  breakdown: TreasuryBreakdown,
  previewResearch: number | null = null,
): BudgetBar {
  const income = Math.max(0, breakdown.income);
  const spend = breakdown.totalExpenditure;
  const previewSpend =
    previewResearch === null ? spend : spend - breakdown.researchSpend + previewResearch;
  const scale = Math.max(income, spend, previewSpend, 1);
  const segments: BudgetSegment[] = BUDGET_SEGMENTS.map((spec) => {
    const value = spec.valueOf(breakdown);
    const previewDelta =
      spec.id === "research" && previewResearch !== null ? previewResearch - value : 0;
    return {
      id: spec.id,
      label: spec.label,
      className: spec.className,
      textClassName: spec.textClassName,
      description: spec.description,
      value,
      width: Math.max(0, value) / scale,
      shareOfSpend: spend > 0 ? Math.max(0, value) / spend : 0,
      shareOfIncome: income > 0 ? Math.max(0, value) / income : 0,
      previewWidth: Math.abs(previewDelta) / scale,
      previewDelta,
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
    scale,
    overBudget,
    overBudgetBy: Math.max(0, spend - income),
    label: `Monthly budget: income ${formatCount(income)}; expenditure ${formatCount(spend)} (${spent}). ${
      overBudget ? "Spending exceeds income." : "Spending is within income."
    }`,
  };
}
