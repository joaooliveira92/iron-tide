import {
  evaluateShipTypeAvailability,
  isShipTypeId,
  SHIP_TYPE_LIST,
  SHIP_TYPES,
  type ShipContext,
  type ShipTypeCategory,
  type ShipTypeId,
} from "@bluewave/ship-design";

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
