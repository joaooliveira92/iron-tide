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

import type { PresentationFormat } from "../../lib/presentation-format/index.js";

export interface ShipTypeChoice {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
}

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

export const shipTypeName = (id: ShipTypeId): string => SHIP_TYPES[id].name;

export const plainShipTypeName = (category: string): string =>
  isShipTypeId(category) ? SHIP_TYPES[category].name : category;

export function shipTypeRole(category: string): string | undefined {
  return isShipTypeId(category) ? SHIP_TYPES[category].description : undefined;
}

export const CATEGORY_LABEL: Readonly<Record<ShipTypeCategory, string>> = {
  CAPITAL_SHIP: "Capital ships",
  CRUISER: "Cruisers",
  LIGHT_COMBATANT: "Light combatants",
  COLONIAL_VESSEL: "Colonial vessels",
  AUXILIARY: "Auxiliaries and special projects",
  AVIATION: "Aviation ships",
  SUBMARINE: "Submarines",
};

const fmt = (format: PresentationFormat, n: number): string =>
  format.number(n, { maximumFractionDigits: 1 });

export function describeRange(
  r: Range,
  unit: string,
  scale = 1,
  format: PresentationFormat,
): string | null {
  const lo = r.min === null || (r.min === 0 && !r.minInclusive) ? null : fmt(format, r.min / scale);
  const hi = r.max === null ? null : fmt(format, r.max / scale);
  const minPart = r.minInclusive ? `${lo} ${unit} or more` : `over ${lo} ${unit}`;
  const maxPart = r.maxInclusive ? `up to ${hi} ${unit}` : `under ${hi} ${unit}`;
  if (lo !== null && hi !== null)
    return r.minInclusive && r.maxInclusive ? `${lo} to ${hi} ${unit}` : `${minPart}, ${maxPart}`;
  if (lo !== null) return minPart;
  if (hi !== null) return maxPart;
  return null;
}
