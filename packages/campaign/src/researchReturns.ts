import { SafeInt } from "@bluewave/contracts";

export interface ResearchReturnsRules {
  readonly fullReturnShareBp: number;
  readonly aboveMarginalBp: number;
}

export function effectiveResearchResources(
  paid: SafeInt,
  revenue: SafeInt,
  rules: ResearchReturnsRules | undefined,
): SafeInt {
  if ((paid as number) <= 0) return SafeInt.ZERO;
  if (rules === undefined) return paid;
  const threshold = SafeInt.div(
    SafeInt.mul(revenue, SafeInt(rules.fullReturnShareBp)),
    SafeInt(10_000),
    "floor",
  );
  if (paid <= threshold) return paid;
  const excess = SafeInt.sub(paid, threshold);
  const counted = SafeInt.div(
    SafeInt.mul(excess, SafeInt(rules.aboveMarginalBp)),
    SafeInt(10_000),
    "floor",
  );
  return SafeInt.add(threshold, counted);
}
