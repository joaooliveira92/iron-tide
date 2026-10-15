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

/**
 * The shipbuilding screen ↔ selection contract (ADR-0142). The drawing pins a `ShipEntity`; this module says
 * which inspector place edits it, and which inspector control a pinned entity owns so focus can follow the
 * ship. It is presentation only: it never changes the design.
 */

/** What the routing reads: the live design and the catalogue (to find a fitting's category). */
export interface RoutingContext {
  readonly draft: DesignDraft;
  readonly content: DrawingBoardContent;
}

/** Where a hull section's editor lives. Magazines and machinery have their own sections; the rest are hull work. */
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

/**
 * The inspector place that edits an entity. A fitting goes to the tab that lists, adds and judges its
 * category (`CATEGORY_PLACE`); a section, a machinery room and the whole ship have fixed homes. Null when
 * the design no longer contains the entity. Exhaustive over the entity kinds.
 */
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

/** The first field of a form group to focus: a value to type, then a choice, then any button. */
const FOCUS_ORDER = [
  "input:not([disabled])",
  '[role="combobox"]:not([data-disabled])',
  "select:not([disabled])",
  "button:not([disabled])",
] as const;

/**
 * The inspector control that edits `entity`: among the `data-ship-link` groups naming it, the most specific
 * wins (a mount's own control over its battery card), and an equally specific control over an equally
 * specific container. Falls back to a matching placement row (`data-placement`). Null when the active tab
 * shows no control for it (the caller has still opened the right place).
 */
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

/** Moves focus into a control (its first field, or the control itself), without scrolling the page. */
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
