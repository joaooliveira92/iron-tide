import type { DesignFeedback } from "./designFeedback.js";
import type { Delta } from "./optionDelta.js";

export function feedbackDeltas(feedback: DesignFeedback | null): readonly Delta[] {
  if (feedback === null) return [];
  return feedback.aspects.map((a): Delta => ({
    id: a.aspect,
    label: a.label,
    text: a.text,
    direction: a.direction,
    tone: a.tone,
  }));
}
