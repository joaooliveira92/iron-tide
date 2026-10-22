import type { SectionId } from "../panels/hull-plan/sections.js";
import type { SettingGroup } from "@bluewave/ship-design";
import type { BoardFinding } from "../validation/boardFindings.js";
import { fittingFacts, machineryRooms, type EntityContext } from "./facts.js";
import type { ShipEntity } from "./store.js";

export const BOARD_TABS = ["hull", "arrangement", "analysis", "build", "tools"] as const;
export type BoardTab = (typeof BOARD_TABS)[number];

const PANEL = {
  brief: "Design brief",
  hull: "Hull and displacement",
  machinery: "Machinery, fuel and range",
  batteries: "Batteries",
  placements: "Components and arrangement",
  protection: "Protection",
} as const;
type PanelKey = keyof typeof PANEL;

const PANEL_TAB: { readonly [K in PanelKey]: BoardTab } = {
  brief: "hull",
  hull: "hull",
  machinery: "hull",
  batteries: "arrangement",
  placements: "arrangement",
  protection: "arrangement",
};

export type FormTarget =
  | { readonly kind: "panel"; readonly panel: PanelKey }
  | { readonly kind: "battery"; readonly key: string }
  | { readonly kind: "placement"; readonly instanceId: string }
  | { readonly kind: "finding"; readonly key: string };

export interface Destination {
  readonly tab: BoardTab;
  readonly target: FormTarget;
  readonly label: string;
}

const SECTION_DESTINATION: { readonly [K in SectionId]: PanelKey } = {
  forecastle: "placements",
  "forward-magazine": "protection",
  "forward-service": "placements",
  "central-machinery": "machinery",
  superstructure: "placements",
  "aft-service": "placements",
  "aft-magazine": "protection",
  quarterdeck: "placements",
};

const PANEL_LABEL: { readonly [K in PanelKey]: string } = {
  brief: "Go to the design brief",
  hull: "Go to hull settings",
  machinery: "Go to machinery settings",
  batteries: "Go to battery settings",
  placements: "Go to arrangement settings",
  protection: "Go to protection settings",
};

const panel = (key: PanelKey): Destination => ({
  tab: PANEL_TAB[key],
  target: { kind: "panel", panel: key },
  label: PANEL_LABEL[key],
});

export function destinationFor(entity: ShipEntity, ctx: EntityContext): Destination | null {
  switch (entity.kind) {
    case "ship":
      return panel("hull");
    case "section":
      return panel(SECTION_DESTINATION[entity.id]);
    case "machinery-room":
      return entity.index < machineryRooms(ctx.draft).length ? panel("machinery") : null;
    case "fitting": {
      const f = fittingFacts(entity.instanceId, ctx);
      if (!f) return null;
      if (f.battery)
        return {
          tab: PANEL_TAB.batteries,
          target: { kind: "battery", key: f.battery.key },
          label: "Go to battery settings",
        };
      return {
        tab: PANEL_TAB.placements,
        target: { kind: "placement", instanceId: entity.instanceId },
        label: "Go to fitting settings",
      };
    }
  }
}

const SETTINGS_PANEL: { readonly [K in SettingGroup]: PanelKey } = {
  brief: "brief",
  hull: "hull",
  machinery: "machinery",
  armour: "protection",
  arrangement: "placements",
};

export function fixDestination(f: BoardFinding): Destination | null {
  if (f.settings === undefined) return null;
  const key = SETTINGS_PANEL[f.settings];
  const fittings = f.entities.flatMap((e) => (e.kind === "fitting" ? [e.instanceId] : []));
  if (key === "placements" && fittings.length === 1 && f.association === "structured")
    return {
      tab: PANEL_TAB.placements,
      target: { kind: "placement", instanceId: fittings[0]! },
      label: "Go to fix",
    };
  return { ...panel(key), label: "Go to fix" };
}

export function analysisDestination(f: BoardFinding): Destination {
  return { tab: "analysis", target: { kind: "finding", key: f.key }, label: "Open in Analysis" };
}

export const BATTERY_ATTR = "data-battery";
export const PLACEMENT_ATTR = "data-placement";
export const FINDING_ATTR = "data-finding-key";
export const SHIP_LINK_ATTR = "data-ship-link";

export function findTarget(root: ParentNode, target: FormTarget): HTMLElement | null {
  const by = (sel: string, attr: string, value: string) =>
    [...root.querySelectorAll<HTMLElement>(sel)].find((el) => el.getAttribute(attr) === value) ??
    null;
  switch (target.kind) {
    case "panel":
      return by('[role="region"]', "aria-label", PANEL[target.panel]);
    case "battery":
      return by(`[${BATTERY_ATTR}]`, BATTERY_ATTR, target.key);
    case "placement":
      return by(`[${PLACEMENT_ATTR}]`, PLACEMENT_ATTR, target.instanceId);
    case "finding":
      return by(`[${FINDING_ATTR}]`, FINDING_ATTR, target.key);
  }
}

export function shipLinkValue(entities: readonly ShipEntity[]): string {
  return JSON.stringify(entities);
}

export function shipLinkAttrs(entities: readonly ShipEntity[]): Record<string, string> {
  return { [SHIP_LINK_ATTR]: shipLinkValue(entities) };
}

const isEntity = (v: unknown): v is ShipEntity => {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    e["kind"] === "ship" ||
    (e["kind"] === "section" && typeof e["id"] === "string") ||
    (e["kind"] === "fitting" && typeof e["instanceId"] === "string") ||
    (e["kind"] === "machinery-room" && typeof e["index"] === "number")
  );
};

export function parseShipLink(value: string | null): ShipEntity[] {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isEntity) : [];
  } catch {
    return [];
  }
}

export function linkedEntities(el: Element | null, ctx: EntityContext): ShipEntity[] {
  const group = el?.closest(`[${SHIP_LINK_ATTR}]`);
  if (group) return parseShipLink(group.getAttribute(SHIP_LINK_ATTR));
  const region = el?.closest('[role="region"]')?.getAttribute("aria-label");
  if (region === PANEL.machinery)
    return machineryRooms(ctx.draft).map((_, index) => ({ kind: "machinery-room", index }));
  return [];
}

export function placementAttrs(instanceId: string): Record<string, string> {
  return {
    [PLACEMENT_ATTR]: instanceId,
    [SHIP_LINK_ATTR]: shipLinkValue([{ kind: "fitting", instanceId }]),
  };
}

export function findingAttrs(f: BoardFinding): Record<string, string> {
  return { [FINDING_ATTR]: f.key, [SHIP_LINK_ATTR]: shipLinkValue(f.entities) };
}

export function batteryAttrs(key: string, instanceIds: readonly string[]): Record<string, string> {
  return {
    [BATTERY_ATTR]: key,
    [SHIP_LINK_ATTR]: shipLinkValue(
      instanceIds.map((instanceId) => ({ kind: "fitting", instanceId })),
    ),
  };
}

export function findDrawingControl(
  root: ParentNode,
  entity: ShipEntity,
): HTMLElement | SVGElement | null {
  const match = (sel: string, attr: string, value: string) =>
    [...root.querySelectorAll<HTMLElement | SVGElement>(sel)].find(
      (el) => el.getAttribute(attr) === value,
    ) ?? null;
  switch (entity.kind) {
    case "ship":
      return match("button[data-ship-findings]", "data-ship-findings", "true");
    case "section":
      return match("button[data-section]", "data-section", entity.id);
    case "fitting":
      return match("[data-target]", "data-target", entity.instanceId);
    case "machinery-room":
      return null;
  }
}
