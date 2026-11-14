import { buildWorkshopView, mm, type DesignDraft } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { planModel } from "../planModel.js";
import { content } from "../test-fixtures.js";
import { floatRatio } from "./draw-waterline.js";
import { buildAnatomyShip } from "./ship-anatomy.js";

const reference = content.references.find((entry) => entry.id === "majestic_like")!;

const compose = (scale: number) => {
  const draft: DesignDraft = {
    ...reference.draft,
    hull: {
      ...reference.draft.hull,
      draught: mm(Math.round(Number(reference.draft.hull.draught) * scale)),
    },
  };
  const view = buildWorkshopView(draft, content.environmentFor(reference.month));
  const model = planModel(draft, content, view, reference.month);
  const ship = buildAnatomyShip({ draft, view, model, azimuth: 135 });
  return { view, ship, waterline: ship.parts.find((part) => part.id === "waterline")! };
};

describe("waterline cue", () => {
  it("sits right after the hull as its own part kind", () => {
    const { ship, waterline } = compose(1);
    expect(waterline.kind).toBe("waterline");
    const ids = ship.parts.map((part) => part.id);
    expect(ids.indexOf("waterline")).toBe(ids.indexOf("hull") + 1);
    expect(waterline.lines[0]?.heavy).toBe(true);
  });

  it("shows the sunken waterline and the shipped water band when the hull is overweight", () => {
    const { view, waterline, ship } = compose(0.6);
    expect(floatRatio(view)).toBeGreaterThan(1);
    expect(waterline.solids).toHaveLength(1);
    expect(waterline.lines.some((line) => line.dotted)).toBe(true);
    expect(ship.facts.get("waterline")).toMatch(/lower/);
  });

  it("shows the raised waterline when the hull floats high", () => {
    const { view, waterline, ship } = compose(1.4);
    expect(floatRatio(view)).toBeLessThan(1);
    expect(waterline.solids).toHaveLength(1);
    expect(ship.facts.get("waterline")).toMatch(/higher/);
  });

  it("draws no offset when the engine flags nothing", () => {
    const scales = Array.from({ length: 41 }, (_, step) => 0.6 + step * 0.02);
    const flagged = scales.map(compose).find(({ view }) => floatRatio(view) === null);
    expect(flagged).toBeDefined();
    expect(flagged!.waterline.solids).toHaveLength(0);
    expect(flagged!.waterline.lines).toHaveLength(1);
  });
});
