import {
  baseGrowthFromRulesets,
  colonyIncomeFromRulesets,
  researchReturnsFromRulesets,
} from "@bluewave/content-compiler";
import { ReplayFileError } from "./format.js";

type Rulesets = Parameters<typeof baseGrowthFromRulesets>[0];

export function productionBaseGrowth(rulesets: Rulesets) {
  const decoded = baseGrowthFromRulesets(rulesets);
  if (decoded === undefined) return undefined;
  if (!decoded.ok)
    throw new ReplayFileError({
      message: `production baseGrowth section is invalid at '${decoded.field}'`,
    });
  return decoded.value;
}

export function productionResearchReturns(rulesets: Rulesets) {
  const decoded = researchReturnsFromRulesets(rulesets);
  if (decoded === undefined) return undefined;
  if (!decoded.ok)
    throw new ReplayFileError({
      message: `production researchReturns section is invalid at '${decoded.field}'`,
    });
  return decoded.value;
}

export function productionColonyIncome(rulesets: Rulesets) {
  const decoded = colonyIncomeFromRulesets(rulesets);
  if (decoded === undefined) return undefined;
  if (!decoded.ok)
    throw new ReplayFileError({
      message: `production colonyIncome section is invalid at '${decoded.field}'`,
    });
  return decoded.value;
}
