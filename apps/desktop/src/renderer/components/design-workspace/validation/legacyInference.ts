import type { DesignDraft, Finding } from "@bluewave/ship-design";
import { formatExplanation } from "../../../lib/presentation-format/index.js";
import { SECTION_IDS, SECTIONS } from "../panels/hull-plan/sections.js";
import type { ShipEntity } from "../selection/store.js";

const escapeRe = /[.*+?^${}()|[\]\\]/g;
const escape = (s: string) => s.replace(escapeRe, "\\$&");
const namingRe = new Map<string, RegExp>();
const naming = (token: string) => {
  let re = namingRe.get(token);
  if (re === undefined) {
    re = new RegExp(`(^|[^A-Za-z0-9_])${escape(token)}([^A-Za-z0-9_]|$)`);
    namingRe.set(token, re);
  }
  return re;
};

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
