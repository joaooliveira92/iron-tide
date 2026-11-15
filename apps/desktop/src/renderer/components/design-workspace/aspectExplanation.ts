import type { FeedbackAspect } from "./designFeedbackTypes.js";
import { METRIC_NOTES } from "./metricNotes.js";

const ASPECT_NOTES: Readonly<Record<FeedbackAspect, string>> = {
  speed: METRIC_NOTES["speed"]!,
  range: METRIC_NOTES["range"]!,
  displacement: METRIC_NOTES["displacement"]!,
  buoyancy: METRIC_NOTES["reserve"]!,
  stability: METRIC_NOTES["stability"]!,
  protection:
    "How much of the ship the armour covers; when coverage is unchanged, the weight of armour added or removed. Armour weight counts toward displacement.",
  firepower:
    "Weight of shell the heavier side can fire in one broadside, from the weapons that bear on that side.",
  cost: "Total build cost: hull, armour, machinery and components, plus overheads and any premiums. The Overview breaks it down.",
  "build-time":
    "Months the forecast yard needs to complete the design. No schedule means the design cannot be planned at any yard as drawn.",
  maintenance: "Monthly upkeep the ship adds to the fleet's running costs once she is in service.",
};

export function aspectExplanation(change: {
  readonly aspect: FeedbackAspect;
  readonly metricId?: string | undefined;
}): string {
  return (
    (change.metricId === undefined ? undefined : METRIC_NOTES[change.metricId]) ??
    ASPECT_NOTES[change.aspect]
  );
}
