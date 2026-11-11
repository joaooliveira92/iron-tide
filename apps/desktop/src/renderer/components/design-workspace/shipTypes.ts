import {
  evaluateShipTypeAvailability,
  isShipTypeId,
  SHIP_TYPE_LIST,
  SHIP_TYPES,
  shipTypeRegistryFromRecords,
  type AvailabilityReason,
  type ShipContext,
  type ShipTypeCategory,
  type ShipTypeId,
} from "@bluewave/ship-design";
import { lockedSummary } from "./availabilityText.js";

export interface ShipTypeChoice {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly locked: boolean;
  readonly disabled?: boolean;
  readonly reasons?: readonly AvailabilityReason[];
  readonly lockedSummary?: string;
}

export function shipTypeChoices(ctx: ShipContext, current: string): ShipTypeChoice[] {
  const registry = ctx.shipTypes === undefined ? null : shipTypeRegistryFromRecords(ctx.shipTypes);
  const choices: ShipTypeChoice[] = (registry?.list ?? SHIP_TYPE_LIST).map((t) => {
    const availability = evaluateShipTypeAvailability(t.id, {
      month: ctx.month,
      unlockedTechs: ctx.unlockedTechs,
      capabilities: ctx.capabilities,
      restrictedTypes: ctx.restrictedShipTypes,
      ...(registry === null ? {} : { definitions: registry.byId }),
    });
    const base = `${CATEGORY_LABEL[t.category]}. ${t.recommendedUse}`;
    if (availability.available)
      return { value: t.id, label: `${t.id} · ${t.name}`, description: base, locked: false };
    const summary = lockedSummary(availability.reasons);
    return {
      value: t.id,
      label: `${t.id} · ${t.name} (locked)`,
      description: `${summary}. ${base}`,
      locked: true,
      disabled: true,
      reasons: availability.reasons,
      lockedSummary: summary,
    };
  });
  if (!choices.some((c) => c.value === current))
    choices.unshift({
      value: current,
      label: `${current} (unknown type)`,
      locked: false,
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
