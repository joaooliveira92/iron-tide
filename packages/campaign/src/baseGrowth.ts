import { SafeInt } from "@bluewave/contracts";
import { MAX_ECONOMIC_BASE, grownBase } from "./economy.js";
import { monthIndex } from "./eventDraw.js";

export interface BaseGrowthRules {
  readonly nations: Readonly<Record<string, { readonly annualGrowthBp: number }>>;
}

export interface BaseGrowthStep {
  readonly base: SafeInt;
  readonly ceilingReached: boolean;
}

export function stepBaseGrowth(
  rules: BaseGrowthRules | undefined,
  nationId: string,
  base: SafeInt,
  campaignMonth: string,
): BaseGrowthStep | undefined {
  const rate = rules?.nations[nationId];
  if (rate === undefined) return undefined;
  const next = grownBase(base, rate.annualGrowthBp, monthIndex(campaignMonth) % 12);
  if (next === base) return undefined;
  return { base: next, ceilingReached: (next as number) === MAX_ECONOMIC_BASE };
}
