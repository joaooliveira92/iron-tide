import type { Severity } from "@bluewave/ship-design";

import type { DesignSectionId } from "../../screens/shipbuilding/design-sections.js";
import type { PartKind } from "./panels/hull-plan/anatomy/anatomy-types.js";

export type FeedbackAspect =
  | "speed"
  | "range"
  | "displacement"
  | "buoyancy"
  | "stability"
  | "protection"
  | "firepower"
  | "cost"
  | "build-time"
  | "maintenance";

export type FeedbackTone = "better" | "worse" | "neutral";

export interface AspectChange {
  readonly aspect: FeedbackAspect;
  readonly label: string;
  readonly text: string;
  readonly direction: "up" | "down" | "flat";
  readonly tone: FeedbackTone;
  readonly parts: readonly PartKind[];
  readonly section: DesignSectionId;
  readonly metricId?: string;
}

export interface FindingChange {
  readonly id: string;
  readonly severity: Severity;
  readonly message: string;
  readonly change: "new" | "resolved";
}

export interface DesignFeedback {
  readonly aspects: readonly AspectChange[];
  readonly findings: readonly FindingChange[];
  readonly hashBefore: string;
  readonly hashAfter: string;
}
