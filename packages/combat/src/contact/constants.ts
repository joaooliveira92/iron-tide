import { BluewaveError } from "@bluewave/contracts";

export const contactLifecyclePolicyId = "contact_lifecycle_v1" as const;
export const CONTACT_CONFIDENCE_MAX_BP = 10_000 as const;
export const CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE = 50 as const;
export const CONTACT_STALE_THRESHOLD_BP = 2_000 as const;

export interface ContactLifecycleContract {
  policyId: string;
  confidenceMaxBp: number;
  confidenceDecayBpPerMinute: number;
  staleThresholdBp: number;
}
export const SHIPPED_CONTACT_LIFECYCLE_CONTRACT: ContactLifecycleContract = {
  policyId: contactLifecyclePolicyId,
  confidenceMaxBp: CONTACT_CONFIDENCE_MAX_BP,
  confidenceDecayBpPerMinute: CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE,
  staleThresholdBp: CONTACT_STALE_THRESHOLD_BP,
};
export function validateContactLifecycleContract(
  c: Partial<ContactLifecycleContract> | null | undefined,
): asserts c is ContactLifecycleContract {
  if (
    !c ||
    c.policyId !== contactLifecyclePolicyId ||
    c.confidenceMaxBp !== CONTACT_CONFIDENCE_MAX_BP ||
    c.confidenceDecayBpPerMinute !== CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE ||
    c.staleThresholdBp !== CONTACT_STALE_THRESHOLD_BP
  ) {
    throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
      code: "TACTICAL_STATE_INVARIANT_FAILED",
      contract: c,
      reason: "contact_lifecycle_v1 mismatch",
    });
  }
}
