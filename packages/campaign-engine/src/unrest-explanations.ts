import type { UnrestLastChange, UnrestReasonCode } from "@bluewave/campaign";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const UNREST_FORMULA_VERSION = "unrest_v1";

const RULE_SOURCE = { kind: "ruleset", ref: "unrest_rules" } as const;
const RECORD_SOURCE = {
  kind: "code",
  ref: "packages/campaign/src/unrest.ts",
} as const;
const UNIT = "unrest";

const CHILD_ID: Readonly<Record<UnrestReasonCode, string>> = {
  MILITARY_SPENDING: "unrest_change.military_spending",
  SPENDING_CUT: "unrest_change.spending_cut",
  WAR_OUTBREAK: "unrest_change.war_outbreak",
  WAR_DURATION: "unrest_change.war_duration",
  BLOCKADE: "unrest_change.blockade",
  DEFEAT: "unrest_change.defeat",
  VICTORY: "unrest_change.victory",
  CRAMPED_ACCOMMODATION: "unrest_change.cramped_accommodation",
  PRESENCE_SHORTFALL: "unrest_change.presence_shortfall",
  EVENT: "unrest_change.event",
  SOCIAL_PROGRAMME: "unrest_change.social_programme",
  REVOLUTION_AFTERMATH: "unrest_change.revolution_aftermath",
};

export function explainUnrestChange(lastChange: UnrestLastChange): ExplanationTree {
  const contributed = lastChange.contributions.reduce((sum, c) => sum + c.delta, 0);
  const clampDelta = lastChange.after - (lastChange.before + contributed);
  const builder = new ExplanationBuilder("unrest_change", UNREST_FORMULA_VERSION)
    .withInput("month", lastChange.month)
    .withIntermediate("unclampedAfter", lastChange.before + contributed)
    .withIntermediate("clampDelta", clampDelta)
    .withResult(lastChange.after)
    .withUnit(UNIT)
    .withOperation("add")
    .withSource(RULE_SOURCE)
    .addChild(
      new ExplanationBuilder("unrest_change.before", UNREST_FORMULA_VERSION)
        .withInput("amount", lastChange.before)
        .withResult(lastChange.before)
        .withUnit(UNIT)
        .withSource(RECORD_SOURCE)
        .build(),
    );
  for (const contribution of lastChange.contributions) {
    builder.addChild(
      new ExplanationBuilder(CHILD_ID[contribution.reasonCode], UNREST_FORMULA_VERSION)
        .withInput("reasonCode", contribution.reasonCode)
        .withResult(contribution.delta)
        .withUnit(UNIT)
        .withOperation(contribution.delta < 0 ? "subtract" : "add")
        .withSource(RULE_SOURCE)
        .build(),
    );
  }
  if (clampDelta !== 0) {
    builder.addChild(
      new ExplanationBuilder("unrest_change.clamp", UNREST_FORMULA_VERSION)
        .withResult(clampDelta)
        .withUnit(UNIT)
        .withOperation("clamp")
        .withSource(RULE_SOURCE)
        .build(),
    );
  }
  return builder.build();
}
