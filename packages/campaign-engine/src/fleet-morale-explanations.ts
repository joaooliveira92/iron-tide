import type { FleetMoraleLastChange, FleetMoraleReasonCode } from "@bluewave/campaign";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

export const FLEET_MORALE_FORMULA_VERSION = "fleet_morale_v1";

const RULE_SOURCE = { kind: "ruleset", ref: "fleet_morale_rules" } as const;
const RECORD_SOURCE = {
  kind: "code",
  ref: "packages/phase-engine/src/fleetMoraleApplication.ts",
} as const;
const UNIT = "morale";

const CHILD_ID: Readonly<Record<FleetMoraleReasonCode, string>> = {
  UNPAID_FUNDS: "fleet_morale_change.unpaid_funds",
  BLOCKADE_CRAMPED: "fleet_morale_change.blockade_cramped",
  RECOVERY: "fleet_morale_change.recovery",
};

export function explainFleetMoraleChange(lastChange: FleetMoraleLastChange): ExplanationTree {
  const clampDelta = lastChange.after - lastChange.unclampedAfter;
  const builder = new ExplanationBuilder("fleet_morale_change", FLEET_MORALE_FORMULA_VERSION)
    .withInput("month", lastChange.month)
    .withIntermediate("unclampedAfter", lastChange.unclampedAfter)
    .withIntermediate("clampDelta", clampDelta)
    .withResult(lastChange.after)
    .withUnit(UNIT)
    .withOperation("add")
    .withSource(RULE_SOURCE)
    .addChild(
      new ExplanationBuilder("fleet_morale_change.before", FLEET_MORALE_FORMULA_VERSION)
        .withInput("amount", lastChange.before)
        .withResult(lastChange.before)
        .withUnit(UNIT)
        .withSource(RECORD_SOURCE)
        .build(),
    );
  for (const contribution of lastChange.contributions) {
    builder.addChild(
      new ExplanationBuilder(CHILD_ID[contribution.reasonCode], FLEET_MORALE_FORMULA_VERSION)
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
      new ExplanationBuilder("fleet_morale_change.clamp", FLEET_MORALE_FORMULA_VERSION)
        .withResult(clampDelta)
        .withUnit(UNIT)
        .withOperation("clamp")
        .withSource(RULE_SOURCE)
        .build(),
    );
  }
  return builder.build();
}
