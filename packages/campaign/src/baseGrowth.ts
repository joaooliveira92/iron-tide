import { SafeInt } from "@bluewave/contracts";
import { MAX_ECONOMIC_BASE, grownBase } from "./economy.js";

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
): BaseGrowthStep | undefined {
  const rate = rules?.nations[nationId];
  if (rate === undefined) return undefined;
  const next = grownBase(base, rate.annualGrowthBp);
  if (next === base) return undefined;
  return { base: next, ceilingReached: (next as number) === MAX_ECONOMIC_BASE };
}
