import { type ArmorZoneType } from "./armorModel.js";
import { type PenetrationOutcome } from "./armorModel.js";

export interface ComponentState {
  id: string;
  componentType: string;
  locationId: string;
  armorZoneType?: ArmorZoneType;
}

export type ComponentOutcome =
  | "UNAFFECTED"
  | "DEGRADED"
  | "JAMMED"
  | "DISABLED"
  | "DESTROYED"
  | "BURNED_OUT"
  | "FLOODED"
  | "ISOLATED";

export interface ComponentDamageResult {
  componentId: string;
  outcome: ComponentOutcome;
  locationId: string;
}

export const SPLINTER_INTENSITIES = ["NONE", "LIGHT", "MEDIUM", "HEAVY", "EXTREME"] as const;
export type SplinterIntensity = (typeof SPLINTER_INTENSITIES)[number];

export function resolveComponentDamage(
  components: readonly ComponentState[],
  hitZoneId: string,
  penetrationOutcome: PenetrationOutcome,
  splinterIntensity: SplinterIntensity,
): ComponentDamageResult[] {
  const zoneComponents = components.filter((c) => c.locationId === hitZoneId);

  if (zoneComponents.length === 0) {
    return [];
  }

  const isPenetrating = isFullPenetration(penetrationOutcome);
  const eligible = zoneComponents.filter((c) => {
    if (isPenetrating) return true;
    return isExposedComponent(c);
  });

  const results: ComponentDamageResult[] = eligible.map((c) => ({
    componentId: c.id,
    outcome: resolveSingleComponentOutcome(c, penetrationOutcome, splinterIntensity),
    locationId: c.locationId,
  }));

  results.sort((a, b) => a.componentId.localeCompare(b.componentId));

  return results;
}

function isFullPenetration(outcome: PenetrationOutcome): boolean {
  return (
    outcome === "FULL_PENETRATION" ||
    outcome === "CRITICAL_PENETRATION" ||
    outcome === "PASS_THROUGH" ||
    outcome === "PARTIAL_PENETRATION"
  );
}

function isExposedComponent(component: ComponentState): boolean {
  const exposedTypes: ReadonlySet<string> = new Set([
    "SUPERSTRUCTURE",
    "DECK",
    "CASEMATE",
    "SPLINTER_DECK",
  ]);
  return component.armorZoneType !== undefined && exposedTypes.has(component.armorZoneType);
}

function resolveSingleComponentOutcome(
  component: ComponentState,
  penetrationOutcome: PenetrationOutcome,
  splinterIntensity: SplinterIntensity,
): ComponentOutcome {
  const splinterMap: Record<SplinterIntensity, number> = {
    NONE: 0,
    LIGHT: 1,
    MEDIUM: 2,
    HEAVY: 3,
    EXTREME: 4,
  };

  const severity = splinterMap[splinterIntensity];

  if (isFullPenetration(penetrationOutcome)) {
    const table: ComponentOutcome[] = ["DEGRADED", "JAMMED", "DISABLED", "DESTROYED", "BURNED_OUT"];
    return table[severity] ?? "UNAFFECTED";
  }

  if (penetrationOutcome === "SPLINTER_EFFECT" && severity > 0) {
    const splinterTable: ComponentOutcome[] = [
      "UNAFFECTED",
      "DEGRADED",
      "JAMMED",
      "DISABLED",
      "DESTROYED",
    ];
    return splinterTable[severity] ?? "UNAFFECTED";
  }

  return "UNAFFECTED";
}
