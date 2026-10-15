/**
 * The central ship workspace's view and overlay vocabulary. A *view* is what the drawing is about
 * (the primary drawing and the layers that read best with it); an *overlay* is an independent layer the
 * player can switch on and off. Views and overlays are presentation only: they never touch the design.
 *
 * The overlays follow the shipbuilding-ui proposal, in its order: armour zones, turret arcs, component
 * footprint, centre of mass, topside load, machinery layout, structural conflicts. "Armour" is spelled
 * the British way to match the rest of the domain (`ArmourPanel`, `ARMOUR_REGIONS`).
 */

/** The views the central visualization switches between. */
export const SHIP_VIEWS = ["top", "side", "armour", "compartments", "arcs"] as const;
export type ShipView = (typeof SHIP_VIEWS)[number];

/** The independent layers a view can show. */
export const SHIP_OVERLAYS = [
  "armour",
  "arcs",
  "footprint",
  "mass",
  "topside",
  "machinery",
  "conflicts",
] as const;
export type ShipOverlay = (typeof SHIP_OVERLAYS)[number];

export interface ShipViewDef {
  readonly id: ShipView;
  /** The selector's label, e.g. "Top". */
  readonly label: string;
  /** One line on what the view emphasises (button tooltip and description). */
  readonly hint: string;
  /** The layers switched on when the view is chosen. */
  readonly overlays: readonly ShipOverlay[];
  /** True when the side profile is the primary drawing and the plan is not drawn. */
  readonly profileOnly: boolean;
}

export const SHIP_VIEW_DEFS: { readonly [K in ShipView]: ShipViewDef & { readonly id: K } } = {
  top: {
    id: "top",
    label: "Top",
    hint: "The waterline plan, looking down: the hull, its sections and the fittings placed on it.",
    overlays: ["arcs", "footprint", "topside", "conflicts"],
    profileOnly: false,
  },
  side: {
    id: "side",
    label: "Side",
    hint: "The side profile: depth, draught, sheer and the fitted structures.",
    overlays: [],
    profileOnly: true,
  },
  armour: {
    id: "armour",
    label: "Armour",
    hint: "The armoured belt over the citadel, with the fittings that carry it.",
    overlays: ["armour", "footprint", "conflicts"],
    profileOnly: false,
  },
  compartments: {
    id: "compartments",
    label: "Compartments",
    hint: "The hull's internal subdivision: its sections and the machinery spaces in them.",
    overlays: ["machinery", "footprint", "conflicts"],
    profileOnly: false,
  },
  arcs: {
    id: "arcs",
    label: "Firing arcs",
    hint: "The gun arcs each mount can bear, and the sectors its neighbours blank off.",
    overlays: ["arcs", "footprint", "conflicts"],
    profileOnly: false,
  },
};

/** The views in selector order. */
export const VIEW_ORDER: readonly ShipViewDef[] = SHIP_VIEWS.map((id) => SHIP_VIEW_DEFS[id]);

export interface ShipOverlayDef {
  readonly id: ShipOverlay;
  readonly label: string;
}

/** The overlays, in the proposal's order, with their control labels. */
export const SHIP_OVERLAY_DEFS: {
  readonly [K in ShipOverlay]: ShipOverlayDef & { readonly id: K };
} = {
  armour: { id: "armour", label: "Armour zones" },
  arcs: { id: "arcs", label: "Turret arcs" },
  footprint: { id: "footprint", label: "Component footprint" },
  mass: { id: "mass", label: "Centre of mass" },
  topside: { id: "topside", label: "Topside load" },
  machinery: { id: "machinery", label: "Machinery layout" },
  conflicts: { id: "conflicts", label: "Structural conflicts" },
};

/** The overlays in control order. */
export const OVERLAY_ORDER: readonly ShipOverlayDef[] = SHIP_OVERLAYS.map(
  (id) => SHIP_OVERLAY_DEFS[id],
);

export const DEFAULT_VIEW: ShipView = "top";

/** The layers a view turns on when it is chosen. A fresh set each call, so callers can hold and edit it. */
export function overlaysOf(view: ShipView): Set<ShipOverlay> {
  return new Set(SHIP_VIEW_DEFS[view].overlays);
}

/** Switches one overlay on or off, leaving every other overlay exactly as it was. */
export function toggleOverlay(
  overlays: ReadonlySet<ShipOverlay>,
  overlay: ShipOverlay,
): Set<ShipOverlay> {
  const next = new Set(overlays);
  if (next.has(overlay)) next.delete(overlay);
  else next.add(overlay);
  return next;
}
