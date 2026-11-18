import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

import { navigationPolicyId } from "./model.js";
import type { NavigationSpeedReasonCode } from "./reasonCodes.js";

export const NAVIGATION_ATTAINABLE_MAX_FORMULA_ID = "navigation_attainable_max" as const;

export interface SpeedReduction {
  readonly reasonCode: NavigationSpeedReasonCode;
  readonly ceilingBp: number;
}

const source = { kind: "ruleset", ref: navigationPolicyId } as const;

export function explainAttainableMax(input: {
  readonly shipId: string;
  readonly baselineBp: number;
  readonly attainableMaxBp: number;
  readonly reductions: readonly SpeedReduction[];
}): ExplanationTree {
  const builder = new ExplanationBuilder(NAVIGATION_ATTAINABLE_MAX_FORMULA_ID, navigationPolicyId)
    .withInput("shipId", input.shipId)
    .withInput("baselineBp", input.baselineBp)
    .withResult(input.attainableMaxBp)
    .withUnit("speedBp")
    .withOperation("clamp")
    .withSource(source);
  for (const reduction of input.reductions) {
    builder.addChild(
      new ExplanationBuilder(
        `${NAVIGATION_ATTAINABLE_MAX_FORMULA_ID}.${reduction.reasonCode}`,
        navigationPolicyId,
      )
        .withInput("reasonCode", reduction.reasonCode)
        .withInput("baselineBp", input.baselineBp)
        .withResult(reduction.ceilingBp)
        .withUnit("speedBp")
        .withOperation("clamp")
        .withSource(source)
        .build(),
    );
  }
  return builder.build();
}
