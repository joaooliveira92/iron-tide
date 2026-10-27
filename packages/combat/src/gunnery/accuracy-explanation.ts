import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";

import { resolveAccuracy, type GunneryAccuracyFactors } from "./accuracy.js";
import {
  GUNNERY_ACCURACY_FACTOR_KEYS,
  NEUTRAL_ACCURACY_MULTIPLIER_BP,
  gunneryAccuracyPolicyId,
} from "./constants.js";

export const GUNNERY_ACCURACY_FORMULA_ID = "gunnery_accuracy" as const;

const source = { kind: "ruleset", ref: gunneryAccuracyPolicyId } as const;

export function explainGunneryAccuracy(factors: GunneryAccuracyFactors): ExplanationTree {
  const resolution = resolveAccuracy(factors);
  const builder = new ExplanationBuilder(GUNNERY_ACCURACY_FORMULA_ID, gunneryAccuracyPolicyId)
    .withInput("baseAccuracyBp", factors.baseAccuracyBp)
    .withIntermediate("rawFlooredBp", resolution.rounding.rawFlooredBp)
    .withResult(resolution.finalAccuracyBp)
    .withUnit("bp")
    .withOperation("multiply")
    .withSource(source);
  for (const key of GUNNERY_ACCURACY_FACTOR_KEYS) {
    const multiplierBp = factors[key];
    if (multiplierBp === NEUTRAL_ACCURACY_MULTIPLIER_BP) continue;
    builder.addChild(
      new ExplanationBuilder(`${GUNNERY_ACCURACY_FORMULA_ID}.${key}`, gunneryAccuracyPolicyId)
        .withInput("multiplierBp", multiplierBp)
        .withResult(multiplierBp)
        .withUnit("bp")
        .withOperation("multiply")
        .withSource(source)
        .build(),
    );
  }
  return builder.build();
}
