import type { DesignFeedback } from "./designFeedback.js";
import type { Delta } from "./optionDelta.js";

export function feedbackDeltas(feedback: DesignFeedback | null): readonly Delta[] {
  if (feedback === null) return [];
  const aspects = feedback.aspects.map((a): Delta => ({
    id: a.aspect,
    label: a.label,
    text: a.text,
    direction: a.direction,
    tone: a.tone,
  }));
  const findings = feedback.findings.map((f): Delta => ({
    id: `finding:${f.change}:${f.id}:${f.message}`,
    label: f.change === "new" ? "New finding" : "Resolved",
    text: f.message,
    direction: "flat",
    tone: f.change === "new" ? "worse" : "better",
  }));
  return [...aspects, ...findings];
}
