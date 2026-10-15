//packages/combat/src/spotting/constants.ts
// Versioned spotting/sensor constants (DESIGN-38 §3 step 8) — baseline clear
// daylight only. Weather/smoke/visibility modifiers defer to B-5; ECM/radar to M5.
import { BluewaveError } from "@bluewave/contracts";

export const spottingSensorPolicyId = "spotting_sensor_v1" as const;
// 1 nautical mile in micrometres (1852 m).
export const NAUTICAL_MILE_UM = 1_852_000_000 as const;
// baseline clear-daylight visual detection range (nmi).
export const VISUAL_DETECTION_RANGE_NMI = 20 as const;
// neutral visibility multiplier (1.0). B-5 multiplies without changing B-2.
export const NEUTRAL_VISIBILITY_MULTIPLIER_BP = 10_000 as const;
// fixed-point scale for the neutral range multiplier.
export const VISIBILITY_BP_SCALE = 10_000 as const;

export interface SpottingSensorContract {
  policyId: string;
  nauticalMileUm: number;
  visualDetectionRangeNmi: number;
  neutralVisibilityMultiplierBp: number;
  visibilityBpScale: number;
}
export const SHIPPED_SPOTTING_SENSOR_CONTRACT: SpottingSensorContract = {
  policyId: spottingSensorPolicyId,
  nauticalMileUm: NAUTICAL_MILE_UM,
  visualDetectionRangeNmi: VISUAL_DETECTION_RANGE_NMI,
  neutralVisibilityMultiplierBp: NEUTRAL_VISIBILITY_MULTIPLIER_BP,
  visibilityBpScale: VISIBILITY_BP_SCALE,
};
export function validateSpottingSensorContract(
  c: Partial<SpottingSensorContract> | null | undefined,
): asserts c is SpottingSensorContract {
  if (
    !c ||
    c.policyId !== spottingSensorPolicyId ||
    c.nauticalMileUm !== NAUTICAL_MILE_UM ||
    c.visualDetectionRangeNmi !== VISUAL_DETECTION_RANGE_NMI ||
    c.neutralVisibilityMultiplierBp !== NEUTRAL_VISIBILITY_MULTIPLIER_BP ||
    c.visibilityBpScale !== VISIBILITY_BP_SCALE
  ) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      contract: c,
      reason: "spotting_sensor_v1 mismatch",
    });
  }
}

export const VISUAL_DETECTION_RANGE_UM: number = VISUAL_DETECTION_RANGE_NMI * NAUTICAL_MILE_UM;
