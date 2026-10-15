import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_VIEW,
  OVERLAY_ORDER,
  SHIP_OVERLAYS,
  SHIP_VIEWS,
  VIEW_ORDER,
  overlaysOf,
  toggleOverlay,
  type ShipOverlay,
} from "./ship-view.js";

describe("ship views", () => {
  it("offers the five proposal views in order, each with a label and a hint", () => {
    expect(VIEW_ORDER.map((v) => v.id)).toEqual([...SHIP_VIEWS]);
    expect(VIEW_ORDER.map((v) => v.label)).toEqual([
      "Top",
      "Side",
      "Armour",
      "Compartments",
      "Firing arcs",
    ]);
    for (const v of VIEW_ORDER) expect(v.hint.length).toBeGreaterThan(0);
  });

  it("draws the profile as the primary drawing only in the side view", () => {
    for (const v of VIEW_ORDER) expect(v.profileOnly).toBe(v.id === "side");
  });

  it("presets the overlays that read with each view, and no view turns every overlay on", () => {
    expect(DEFAULT_VIEW).toBe("top");
    expect([...overlaysOf("top")].sort()).toEqual(["arcs", "conflicts", "footprint", "topside"]);
    expect(overlaysOf("side").size).toBe(0);
    expect(overlaysOf("armour").has("armour")).toBe(true);
    expect(overlaysOf("compartments").has("machinery")).toBe(true);
    expect(overlaysOf("arcs").has("arcs")).toBe(true);
    for (const v of SHIP_VIEWS) expect(overlaysOf(v).size).toBeLessThan(SHIP_OVERLAYS.length);
  });

  it("returns a fresh, editable set each time", () => {
    const a = overlaysOf("top");
    a.delete("arcs");
    expect(overlaysOf("top").has("arcs")).toBe(true);
  });
});

describe("ship overlays", () => {
  it("lists the proposal's overlays, in its order", () => {
    expect(OVERLAY_ORDER.map((o) => o.id)).toEqual([...SHIP_OVERLAYS]);
    expect(OVERLAY_ORDER.map((o) => o.label)).toEqual([
      "Armour zones",
      "Turret arcs",
      "Component footprint",
      "Centre of mass",
      "Topside load",
      "Machinery layout",
      "Structural conflicts",
    ]);
    for (const o of OVERLAY_ORDER) expect(o.label.length).toBeGreaterThan(0);
  });

  it("toggles one overlay without touching any other", () => {
    const base: ReadonlySet<ShipOverlay> = new Set<ShipOverlay>(["arcs", "footprint"]);
    expect([...toggleOverlay(base, "mass")].sort()).toEqual(["arcs", "footprint", "mass"]);
    expect(toggleOverlay(base, "arcs")).toEqual(new Set<ShipOverlay>(["footprint"]));
    // The input is left as it was.
    expect(base).toEqual(new Set<ShipOverlay>(["arcs", "footprint"]));
  });
});
