import { SEVERITY_ORDER, type Finding, type WorkshopView } from "@bluewave/ship-design";

import { formatExplanation } from "../../lib/presentation-format/index.js";
import type { FindingChange } from "./designFeedbackTypes.js";

const keyOf = (finding: Finding): string =>
  `${finding.id}|${finding.severity}|${JSON.stringify(finding.subject?.targets ?? [])}`;

const keyed = (view: WorkshopView): ReadonlyMap<string, Finding> => {
  const out = new Map<string, Finding>();
  for (const finding of view.compiled.findings) out.set(keyOf(finding), finding);
  return out;
};

const compare = (a: FindingChange, b: FindingChange): number => {
  const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
  if (bySeverity !== 0) return bySeverity;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  if (a.change !== b.change) return a.change === "new" ? -1 : 1;
  return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
};

const changeOf = (finding: Finding, change: FindingChange["change"]): FindingChange => ({
  id: finding.id,
  severity: finding.severity,
  message: formatExplanation(finding.what),
  change,
});

export function diffFindings(before: WorkshopView, after: WorkshopView): readonly FindingChange[] {
  const was = keyed(before);
  const now = keyed(after);
  const out: FindingChange[] = [];
  for (const [key, finding] of now) if (!was.has(key)) out.push(changeOf(finding, "new"));
  for (const [key, finding] of was) if (!now.has(key)) out.push(changeOf(finding, "resolved"));
  return out.sort(compare);
}
