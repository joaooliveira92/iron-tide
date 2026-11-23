import { SafeInt } from "@bluewave/contracts";
import { monthlyRevenue } from "./economy.js";
import type { PossessionData } from "./state.js";

const BP = 10_000;

export interface ColonyIncomeRules {
  readonly baselineYear: number;
  readonly startFactorBp: number;
  readonly slopeBpPerYear: number;
  readonly floorBp: number;
}

export interface ColonyIncomeStep {
  readonly amount: SafeInt;
  readonly valueBp: number;
  readonly factorBp: number;
}

function elapsedMonths(rules: ColonyIncomeRules, month: string): number {
  const year = Number(month.slice(0, 4));
  const monthOfYear = Number(month.slice(5, 7));
  const elapsed = (year - rules.baselineYear) * 12 + (monthOfYear - 1);
  return elapsed > 0 ? elapsed : 0;
}

export function colonyDecayFactorBp(rules: ColonyIncomeRules, month: string): number {
  const decayed = Math.floor((rules.slopeBpPerYear * elapsedMonths(rules, month)) / 12);
  const factor = rules.startFactorBp - decayed;
  return factor > rules.floorBp ? factor : rules.floorBp;
}

export function colonyIncomeForNation(
  rules: ColonyIncomeRules | undefined,
  possessions: readonly PossessionData[],
  nationId: string,
  base: SafeInt,
  month: string,
): ColonyIncomeStep | undefined {
  if (rules === undefined) return undefined;
  let valueBp = 0;
  for (const possession of possessions)
    if (possession.nationId === nationId) valueBp += possession.colonyValueBp ?? 0;
  if (valueBp <= 0) return undefined;
  const factorBp = colonyDecayFactorBp(rules, month);
  const gross = monthlyRevenue(base, SafeInt(valueBp));
  const amount = SafeInt.div(SafeInt.mul(gross, SafeInt(factorBp)), SafeInt(BP), "floor");
  if ((amount as number) <= 0) return undefined;
  return { amount, valueBp, factorBp };
}
