import type { DesignDraft } from "@bluewave/ship-design";
import type { DrawingBoardContent } from "../../components/design-workspace/content.js";
import {
  PLACEMENT_ATTR,
  SHIP_LINK_ATTR,
  parseShipLink,
} from "../../components/design-workspace/selection/navigation.js";
import { sameEntity, type ShipEntity } from "../../components/design-workspace/selection/store.js";
import type { SectionId } from "../../components/design-workspace/panels/hull-plan/sections.js";
import { CATEGORY_PLACE, placeOf, type InspectorPlace } from "./design-sections.js";

export interface RoutingContext {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
}

const SECTION_PLACE: { readonly [K in SectionId]: InspectorPlace } = {
  forecastle: placeOf("hull", "dimensions"),
  "forward-magazine": placeOf("protection", "magazines"),
  "forward-service": placeOf("hull", "dimensions"),
  "central-machinery": placeOf("machinery", "propulsion"),
  superstructure: placeOf("hull", "dimensions"),
  "aft-service": placeOf("hull", "dimensions"),
  "aft-magazine": placeOf("protection", "magazines"),
  quarterdeck: placeOf("hull", "dimensions"),
};

export function placeForEntity(entity: ShipEntity, ctx: RoutingContext): InspectorPlace | null {
  switch (entity.kind) {
    case "ship":
      return placeOf("overview", "summary");
    case "section":
      return SECTION_PLACE[entity.id];
    case "machinery-room":
      return placeOf("machinery", "propulsion");
    case "fitting": {
      const placed = ctx.draft.placements.find((p) => p.instanceId === entity.instanceId);
      if (!placed) return null;
      const entry = ctx.content.catalogue.find((e) => e.id === placed.componentId);
      if (!entry) return null;
      return CATEGORY_PLACE[entry.category];
    }
  }
}

const FOCUS_ORDER = [
  "input:not([disabled])",
  '[role="combobox"]:not([data-disabled])',
  "select:not([disabled])",
  "button:not([disabled])",
] as const;

export function findEntityControl(root: ParentNode, entity: ShipEntity): HTMLElement | null {
  let best: { readonly el: HTMLElement; readonly count: number; readonly control: boolean } | null =
    null;
  for (const group of root.querySelectorAll<HTMLElement>(`[${SHIP_LINK_ATTR}]`)) {
    const entities = parseShipLink(group.getAttribute(SHIP_LINK_ATTR));
    if (!entities.some((e) => sameEntity(e, entity))) continue;
    const control = group.matches("button, input, select, textarea, [role='combobox'], a[href]");
    const better =
      best === null ||
      entities.length < best.count ||
      (entities.length === best.count && control && !best.control);
    if (better) best = { el: group, count: entities.length, control };
  }
  if (best !== null) return best.el;
  if (entity.kind === "fitting") {
    const rows = root.querySelectorAll<HTMLElement>(`[${PLACEMENT_ATTR}]`);
    return [...rows].find((row) => row.getAttribute(PLACEMENT_ATTR) === entity.instanceId) ?? null;
  }
  return null;
}

export function focusEntityControl(root: ParentNode, entity: ShipEntity): boolean {
  const control = findEntityControl(root, entity);
  if (control === null) return false;
  const field = FOCUS_ORDER.map((sel) => control.querySelector<HTMLElement>(sel)).find(
    (el) => el !== null,
  );
  if (field) {
    field.focus({ preventScroll: true });
    return true;
  }
  control.tabIndex = -1;
  control.focus({ preventScroll: true });
  return true;
}
