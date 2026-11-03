export const SHIP_VIEWS = ["top", "side", "iso"] as const;
export type ShipView = (typeof SHIP_VIEWS)[number];

export const SHIP_OVERLAYS = [
  "armour",
  "arcs",
  "footprint",
  "mass",
  "topside",
  "machinery",
  "compartments",
  "conflicts",
] as const;
export type ShipOverlay = (typeof SHIP_OVERLAYS)[number];

export interface ShipViewDef {
  readonly id: ShipView;
  readonly label: string;
  readonly hint: string;
  readonly overlays: readonly ShipOverlay[];
  readonly editable: boolean;
}

export const SHIP_VIEW_DEFS: { readonly [K in ShipView]: ShipViewDef & { readonly id: K } } = {
  top: {
    id: "top",
    label: "Top",
    hint: "The waterline plan, looking down: the hull, its sections and the fittings placed on it.",
    overlays: ["arcs", "footprint", "topside", "conflicts"],
    editable: true,
  },
  side: {
    id: "side",
    label: "Side",
    hint: "The side profile: depth, draught, sheer and the fitted structures.",
    overlays: [],
    editable: false,
  },
  iso: {
    id: "iso",
    label: "Isometric",
    hint: "The ship in three dimensions, with every fitting drawn where it stands.",
    overlays: [],
    editable: false,
  },
};

export const VIEW_ORDER: readonly ShipViewDef[] = SHIP_VIEWS.map((id) => SHIP_VIEW_DEFS[id]);

export interface ShipOverlayDef {
  readonly id: ShipOverlay;
  readonly label: string;
}

export const SHIP_OVERLAY_DEFS: {
  readonly [K in ShipOverlay]: ShipOverlayDef & { readonly id: K };
} = {
  armour: { id: "armour", label: "Armour zones" },
  arcs: { id: "arcs", label: "Turret arcs" },
  footprint: { id: "footprint", label: "Component footprint" },
  mass: { id: "mass", label: "Centre of mass" },
  topside: { id: "topside", label: "Topside load" },
  machinery: { id: "machinery", label: "Machinery layout" },
  compartments: { id: "compartments", label: "Compartments" },
  conflicts: { id: "conflicts", label: "Structural conflicts" },
};

export const OVERLAY_ORDER: readonly ShipOverlayDef[] = SHIP_OVERLAYS.map(
  (id) => SHIP_OVERLAY_DEFS[id],
);

export const DEFAULT_VIEW: ShipView = "top";

export function overlaysOf(view: ShipView): Set<ShipOverlay> {
  return new Set(SHIP_VIEW_DEFS[view].overlays);
}

export function toggleOverlay(
  overlays: ReadonlySet<ShipOverlay>,
  overlay: ShipOverlay,
): Set<ShipOverlay> {
  const next = new Set(overlays);
  if (next.has(overlay)) next.delete(overlay);
  else next.add(overlay);
  return next;
}
