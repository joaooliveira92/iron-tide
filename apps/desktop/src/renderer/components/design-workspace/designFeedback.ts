import type { WorkshopView } from "@bluewave/ship-design";

import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { diffAspects } from "./designFeedbackAspects.js";
import { diffFindings } from "./designFeedbackFindings.js";
import type { DesignFeedback } from "./designFeedbackTypes.js";

export type {
  AspectChange,
  DesignFeedback,
  FeedbackAspect,
  FeedbackTone,
  FindingChange,
} from "./designFeedbackTypes.js";

export function diffViews(
  before: WorkshopView,
  after: WorkshopView,
  format: PresentationFormat,
): DesignFeedback {
  return {
    aspects: diffAspects(before, after, format),
    findings: diffFindings(before, after),
    hashBefore: before.compiled.hash,
    hashAfter: after.compiled.hash,
  };
}
