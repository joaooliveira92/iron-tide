import type { DesignDraft, Finding } from "@bluewave/ship-design";
import { formatExplanation } from "../../../lib/presentation-format/index.js";
import { SECTION_IDS, SECTIONS } from "../panels/hull-plan/sections.js";
import type { ShipEntity } from "../selection/store.js";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const naming = (token: string) => new RegExp(`(^|[^A-Za-z0-9_])${escape(token)}([^A-Za-z0-9_]|$)`);

/**
 * COMPATIBILITY FALLBACK, the only place that reads finding wording: for a finding whose rule has no structured
 * subject yet, the fittings and sections its text names as whole words. Results are marked "inferred" by the
 * caller and never presented as authoritative. Remove a rule from here by giving its producer targets.
 */
export function inferEntities(f: Finding, draft: DesignDraft): ShipEntity[] {
  const text = `${formatExplanation(f.what)} ${formatExplanation(f.why)}`;
  const fittings: ShipEntity[] = draft.placements
    .filter((p) => naming(p.instanceId).test(text))
    .map((p) => ({ kind: "fitting", instanceId: p.instanceId }));
  const sections: ShipEntity[] = SECTION_IDS.filter((id) =>
    naming(SECTIONS[id].zoneId).test(text),
  ).map((id) => ({ kind: "section", id }));
  return [...fittings, ...sections];
}
