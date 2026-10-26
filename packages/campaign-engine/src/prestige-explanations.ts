import type { PrestigeLastChange } from "@bluewave/campaign";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const PRESTIGE_FORMULA_VERSION = "prestige_v1";

const RULE_SOURCE = { kind: "ruleset", ref: "prestige_rules" } as const;
const RECORD_SOURCE = {
  kind: "code",
  ref: "packages/phase-engine/src/prestigeApplication.ts",
} as const;
const UNIT = "prestige";

function recordedChild(formulaId: string, amount: number): ExplanationTree {
  return new ExplanationBuilder(formulaId, PRESTIGE_FORMULA_VERSION)
    .withInput("amount", Math.abs(amount))
    .withResult(amount)
    .withUnit(UNIT)
    .withSource(RECORD_SOURCE)
    .build();
}

export function explainPrestigeChange(lastChange: PrestigeLastChange): ExplanationTree | undefined {
  const { appliedRule, unclampedAfter, bounds } = lastChange;
  if (appliedRule === undefined || unclampedAfter === undefined || bounds === undefined) {
    return undefined;
  }
  const before = Number(lastChange.before);
  const after = Number(lastChange.after);
  const target = Number(unclampedAfter);
  const ruleDelta = target - before;
  const clampDelta = after - target;
  const ruleRate =
    appliedRule.kind === "PROPORTIONAL_LOSS" ? appliedRule.basisPoints : appliedRule.amount;

  const builder = new ExplanationBuilder("prestige_change", PRESTIGE_FORMULA_VERSION)
    .withInput("reasonCode", lastChange.reasonCode)
    .withInput("ruleKind", appliedRule.kind)
    .withInput("ruleRate", Number(ruleRate))
    .withInput("lowerBound", Number(bounds.lower))
    .withInput("upperBound", Number(bounds.upper))
    .withIntermediate("unclampedAfter", target)
    .withIntermediate("clampDelta", clampDelta)
    .withResult(after)
    .withUnit(UNIT)
    .withOperation("add")
    .withSource(RULE_SOURCE)
    .addChild(recordedChild("prestige_change.before", before))
    .addChild(
      new ExplanationBuilder("prestige_change.rule", PRESTIGE_FORMULA_VERSION)
        .withInput("ruleKind", appliedRule.kind)
        .withInput("ruleRate", Number(ruleRate))
        .withResult(ruleDelta)
        .withUnit(UNIT)
        .withOperation(appliedRule.kind === "FIXED_GAIN" ? "add" : "subtract")
        .withSource(RULE_SOURCE)
        .build(),
    );
  if (clampDelta !== 0) {
    builder.addChild(
      new ExplanationBuilder("prestige_change.clamp", PRESTIGE_FORMULA_VERSION)
        .withInput("lowerBound", Number(bounds.lower))
        .withInput("upperBound", Number(bounds.upper))
        .withResult(clampDelta)
        .withUnit(UNIT)
        .withOperation("clamp")
        .withSource(RULE_SOURCE)
        .build(),
    );
  }
  return builder.build();
}
