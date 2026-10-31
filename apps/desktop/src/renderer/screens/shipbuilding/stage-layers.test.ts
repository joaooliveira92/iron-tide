import { describe, expect, it } from "vite-plus/test";
import { overlaysOf } from "../../components/design-workspace/panels/hull-plan/ship-view.js";
import { DESIGN_SECTIONS } from "./design-sections.js";
import { focusesArcs, layersFor } from "./stage-layers.js";

describe("layersFor", () => {
  it("starts from the top view's layers when no section is open", () => {
    expect([...layersFor(null)].sort()).toEqual([...overlaysOf("top")].sort());
  });

  it("adds the layer that explains the open section", () => {
    expect(layersFor("protection").has("armour")).toBe(true);
    expect(layersFor("machinery").has("machinery")).toBe(true);
    expect(layersFor("machinery").has("compartments")).toBe(true);
    expect(layersFor("hull").has("mass")).toBe(true);
  });

  it("never lights every layer at once, and returns a fresh set each time", () => {
    for (const section of DESIGN_SECTIONS) expect(layersFor(section).size).toBeLessThan(8);
    const a = layersFor("protection");
    a.clear();
    expect(layersFor("protection").size).toBeGreaterThan(0);
  });
});

describe("focusesArcs", () => {
  it("labels the firing arcs only while the armament panel is open", () => {
    expect(focusesArcs("armament")).toBe(true);
    expect(focusesArcs("hull")).toBe(false);
    expect(focusesArcs(null)).toBe(false);
  });
});
