import type { SafeInt } from "@bluewave/contracts";
import type { AppliedPrestigeRule, PrestigeBounds, PrestigeReasonCode } from "./prestige.js";

export interface PrestigeLastChange {
  reasonCode: PrestigeReasonCode | (string & {});
  before: SafeInt;
  after: SafeInt;
  delta: SafeInt;
  month: string;
  appliedRule?: AppliedPrestigeRule;
  unclampedAfter?: SafeInt;
  bounds?: PrestigeBounds;
}
