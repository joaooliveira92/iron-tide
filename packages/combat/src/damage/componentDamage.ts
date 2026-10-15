// DESIGN-41 §6 — Local component damage resolution.
// Pure function that selects components by spatial eligibility (hit zone),
// orders them by stable component id, then assigns an outcome per component
// based on the penetration outcome and splinter intensity.
// Pure/deterministic: no ambient I/O/clock/random.
import { type ArmorZoneType } from "./armorModel.js";
import { type PenetrationOutcome } from "./armorModel.js";

// Component types

export interface ComponentState {
  id: string;
  componentType: string;
  locationId: string; // compartment/zone this component lives in
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

// Splinter intensity levels

export const SPLINTER_INTENSITIES = ["NONE", "LIGHT", "MEDIUM", "HEAVY", "EXTREME"] as const;
export type SplinterIntensity = (typeof SPLINTER_INTENSITIES)[number];

// Mapping from penetration outcome + splinter intensity → component outcome
// table for in-zone components (full penetration hits everything; non-penetrating
// hits only affect exposed components per §6).

// For a full penetration (FULL_PENETRATION, CRITICAL_PENETRATION) all in-zone
// components receive at minimum DEGRADED, with escalating severity.
// For non-penetrating / partial hits, outcomes are lower severity.
// PASS_THROUGH creates DEGRADED effects (overpenetration still damages).
// DUD and NO_EFFECT create no component damage (unless splinters).

/**
 * Resolve local component damage for a hit zone.
 *
 * Per DESIGN-41 §6:
 * - Components are selected by spatial eligibility (those whose locationId
 *   matches hitZoneId, or are considered "in" the hit zone).
 * - Non-penetrating hits (NO_EFFECT, DUD, SPLINTER_EFFECT) only affect
 *   exposed components (those with armorZoneType that is exposed, e.g.,
 *   SUPERSTRUCTURE, DECK).
 * - Full penetrations (PARTIAL_PENETRATION, FULL_PENETRATION,
 *   CRITICAL_PENETRATION, PASS_THROUGH) affect all in-zone components.
 * - Splinter intensity escalates outcomes for exposed components.
 * - Results are ordered by stable component id (DESIGN-41 §6 ordering).
 *
 * @param components - All components on the ship.
 * @param hitZoneId - The zone/compartment that was hit.
 * @param penetrationOutcome - The penetration outcome from Stage 2.
 * @param splinterIntensity - Splinter intensity from the hit.
 * @returns Ordered array of component damage results (by component id).
 */
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
    // Non-penetrating: only exposed components (superstructure, deck, etc.)
    return isExposedComponent(c);
  });

  const results: ComponentDamageResult[] = eligible.map((c) => ({
    componentId: c.id,
    outcome: resolveSingleComponentOutcome(c, penetrationOutcome, splinterIntensity),
    locationId: c.locationId,
  }));

  // Step 4: order by stable component id per §6
  results.sort((a, b) => a.componentId.localeCompare(b.componentId));

  return results;
}

// ---- Internal helpers ----

/**
 * Whether a penetration outcome is considered "full penetration" for
 * component eligibility purposes.
 */
function isFullPenetration(outcome: PenetrationOutcome): boolean {
  return (
    outcome === "FULL_PENETRATION" ||
    outcome === "CRITICAL_PENETRATION" ||
    outcome === "PASS_THROUGH" ||
    outcome === "PARTIAL_PENETRATION"
  );
}

/**
 * Whether a component is "exposed" (vulnerable to non-penetrating damage).
 * Exposed components are those in superstructure/deck/casemate/splinter-deck zones.
 * Internal components (engine, pumps, etc.) without an armor zone type are NOT exposed.
 * Only components with an explicitly listed exposed armor zone type qualify.
 */
function isExposedComponent(component: ComponentState): boolean {
  const exposedTypes: ReadonlySet<string> = new Set([
    "SUPERSTRUCTURE",
    "DECK",
    "CASEMATE",
    "SPLINTER_DECK",
  ]);
  return component.armorZoneType !== undefined && exposedTypes.has(component.armorZoneType);
}

// §6 outcome severity by penetration outcome + splinter intensity
// Outcomes (from least to most severe):
// UNAFFECTED < DEGRADED < JAMMED < DISABLED < DESTROYED < BURNED_OUT
// FLOODED and ISOLATED are special-case outcomes for flooding/hull.

/**
 * Resolve a single component's outcome based on hit characteristics.
 *
 * The table maps (penetrationOutcome, splinterIntensity) → ComponentOutcome.
 * Full penetrations escalate via splinter intensity:
 *   NONE → DEGRADED
 *   LIGHT → JAMMED
 *   MEDIUM → DISABLED
 *   HEAVY → DESTROYED
 *   EXTREME → BURNED_OUT
 *
 * Non-penetrating hits on exposed components use splinter-only damage:
 *   NONE → UNAFFECTED
 *   LIGHT → DEGRADED
 *   MEDIUM → JAMMED
 *   HEAVY → DISABLED
 *   EXTREME → DESTROYED
 *
 * DUD / NO_EFFECT → UNAFFECTED (unless splinters on exposed components)
 */
function resolveSingleComponentOutcome(
  component: ComponentState,
  penetrationOutcome: PenetrationOutcome,
  splinterIntensity: SplinterIntensity,
): ComponentOutcome {
  // Map splinter intensity to a numeric severity [0..4]
  const splinterMap: Record<SplinterIntensity, number> = {
    NONE: 0,
    LIGHT: 1,
    MEDIUM: 2,
    HEAVY: 3,
    EXTREME: 4,
  };

  const severity = splinterMap[splinterIntensity];

  if (isFullPenetration(penetrationOutcome)) {
    // Full penetration table (affects all eligible components)
    const table: ComponentOutcome[] = ["DEGRADED", "JAMMED", "DISABLED", "DESTROYED", "BURNED_OUT"];
    return table[severity] ?? "UNAFFECTED";
  }

  // Non-penetrating / splinter-only on exposed components
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

  // DUD or NO_EFFECT: unaffected (splinter intensity is typically NONE)
  return "UNAFFECTED";
}
