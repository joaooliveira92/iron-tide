import {
  evaluateShipTypeAvailability,
  isShipTypeId,
  SHIP_TYPE_LIST,
  SHIP_TYPES,
  type Range,
  type ShipContext,
  type ShipTypeCategory,
  type ShipTypeId,
} from "@bluewave/ship-design";

export interface ShipTypeChoice {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

/**
 * The ship types a brief may choose under the rules context: only the types the campaign allows now (the application
 * convention omits what is unavailable). A current type outside that set (an authored brief, a stale draft) stays
 * listed first and marked, so the control never lies about the draft.
 */
export function shipTypeChoices(ctx: ShipContext, current: string): ShipTypeChoice[] {
  const offered = SHIP_TYPE_LIST.filter(
    (t) =>
      evaluateShipTypeAvailability(t.id, {
        month: ctx.month,
        unlockedTechs: ctx.unlockedTechs,
        capabilities: ctx.capabilities,
        restrictedTypes: ctx.restrictedShipTypes,
      }).available,
  );
  const choices: ShipTypeChoice[] = offered.map((t) => ({
    value: t.id,
    label: `${t.id} · ${t.name}`,
    description: `${CATEGORY_LABEL[t.category]}. ${t.recommendedUse}`,
  }));
  if (!offered.some((t) => t.id === current))
    choices.unshift({
      value: current,
      label: isShipTypeId(current)
        ? `${current} · ${SHIP_TYPES[current].name} (not available)`
        : `${current} (unknown type)`,
    });
  return choices;
}

/** Display names and one-line roles come from the domain registry (`SHIP_TYPES`); nothing is restated here. */
export const shipTypeName = (id: ShipTypeId): string => SHIP_TYPES[id].name;

/** The one-line role of a ship-type code, when the code is a registered type. */
export function shipTypeRole(category: string): string | undefined {
  return isShipTypeId(category) ? SHIP_TYPES[category].description : undefined;
}

/** Group headings of the selection list, in display order. Presentation text only. */
export const CATEGORY_LABEL: Readonly<Record<ShipTypeCategory, string>> = {
  CAPITAL_SHIP: "Capital ships",
  CRUISER: "Cruisers",
  LIGHT_COMBATANT: "Light combatants",
  COLONIAL_VESSEL: "Colonial vessels",
  AUXILIARY: "Auxiliaries and special projects",
  AVIATION: "Aviation ships",
  SUBMARINE: "Submarines",
};

const fmt = (n: number): string =>
  n.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/**
 * A range as player text: "5,000 t or more", "over 19 kn", "under 2,000 t", "6 to 12 in" (exclusive bounds read
 * "over"/"under"). `scale` converts the domain unit to the shown unit (kg to tonnes: 1000). Null when unbounded.
 */
export function describeRange(r: Range, unit: string, scale = 1): string | null {
  // "Over zero" is just "positive": not a limit worth printing.
  const lo = r.min === null || (r.min === 0 && !r.minInclusive) ? null : fmt(r.min / scale);
  const hi = r.max === null ? null : fmt(r.max / scale);
  const minPart = r.minInclusive ? `${lo} ${unit} or more` : `over ${lo} ${unit}`;
  const maxPart = r.maxInclusive ? `up to ${hi} ${unit}` : `under ${hi} ${unit}`;
  if (lo !== null && hi !== null)
    return r.minInclusive && r.maxInclusive ? `${lo} to ${hi} ${unit}` : `${minPart}, ${maxPart}`;
  if (lo !== null) return minPart;
  if (hi !== null) return maxPart;
  return null;
}
