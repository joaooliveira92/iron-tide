import type { WorkshopView } from "@bluewave/ship-design";

import type { PresentationFormat } from "../../lib/presentation-format/index.js";
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
  _format: PresentationFormat,
): DesignFeedback {
  return {
    aspects: [],
    findings: [],
    hashBefore: before.compiled.hash,
    hashAfter: after.compiled.hash,
  };
}
