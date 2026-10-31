import type { SettingGroup } from "@bluewave/ship-design";
import type { BoardFinding } from "../../components/design-workspace/validation/boardFindings.js";
import type { ShipEntity } from "../../components/design-workspace/selection/store.js";
import type { ShipView } from "../../components/design-workspace/panels/hull-plan/ship-view.js";
import { SECTIONS, placeOf, type InspectorPlace } from "./design-sections.js";
import { placeForEntity, type RoutingContext } from "./selection.js";

export type FlawTier = "blocking" | "critical" | "warning";

export interface Flaw {
  readonly finding: BoardFinding;
  readonly tier: FlawTier;
  readonly verdict: string;
  readonly fix: { readonly place: InspectorPlace; readonly label: string } | null;
  readonly showOn: ShipEntity | null;
}

const VERDICT: { readonly [T in FlawTier]: string } = {
  blocking: "Blocks submission",
  critical: "Serious, but the ship can still be built",
  warning: "A trade-off to review",
};

const SETTINGS_PLACE: { readonly [G in SettingGroup]: InspectorPlace | null } = {
  brief: placeOf("overview", "brief"),
  hull: placeOf("hull", "dimensions"),
  machinery: placeOf("machinery", "propulsion"),
  armour: placeOf("protection", "armour"),
  arrangement: null,
};

function tierOf(severity: BoardFinding["severity"]): FlawTier | null {
  switch (severity) {
    case "BLOCKING":
      return "blocking";
    case "CRITICAL":
      return "critical";
    case "WARNING":
      return "warning";
    case "ADVISORY":
      return null;
  }
}

function fixPlaceOf(finding: BoardFinding, ctx: RoutingContext): InspectorPlace | null {
  if (finding.settings !== undefined) {
    const place = SETTINGS_PLACE[finding.settings];
    if (place !== null) return place;
  }
  for (const entity of finding.entities) {
    if (entity.kind === "ship") continue;
    const place = placeForEntity(entity, ctx);
    if (place !== null) return place;
  }
  return null;
}

export function flawQueue(findings: readonly BoardFinding[], ctx: RoutingContext): Flaw[] {
  return findings.flatMap((finding): Flaw[] => {
    const tier = tierOf(finding.severity);
    if (tier === null) return [];
    const place = fixPlaceOf(finding, ctx);
    return [
      {
        finding,
        tier,
        verdict: VERDICT[tier],
        fix: place === null ? null : { place, label: `Fix in ${SECTIONS[place.section].label}` },
        showOn: finding.entities[0] ?? null,
      },
    ];
  });
}

export function viewForEntity(entity: ShipEntity, current: ShipView): ShipView {
  switch (entity.kind) {
    case "ship":
      return current;
    case "fitting":
      return current === "side" ? "top" : current;
    case "section":
    case "machinery-room":
      return "top";
  }
}
