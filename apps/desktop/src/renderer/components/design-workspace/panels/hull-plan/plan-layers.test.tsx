import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { ZONE_IDS } from "@bluewave/ship-design";
import { PLAN_MID, planFrame } from "./geometry.js";
import { HullDeckLayer, HullOutlineLayer, HullShapeLayer, HullZoneLayer } from "./plan-layers.js";
import { hullForm as form, reference } from "./test-fixtures.js";

/** A ram frame: the layer's ram beak only draws for a ram bow, which the reference ship is not. */
const frame = planFrame(reference.draft.hull, {
  waterplaneCoeffBp: form.waterplaneCoeffBp,
  lcbPermille: form.lcbPermille,
  bow: "ram",
  stern: "counter",
});
const draw = (ui: React.ReactNode) => render(<svg>{ui}</svg>);

describe("HullShapeLayer", () => {
  it("draws a closed outline polygon and a dimmed deck-edge inset", () => {
    const { container } = draw(<HullShapeLayer frame={frame} />);
    const outline = container.querySelector("[data-testid='hull-outline']")!;
    expect(outline.tagName.toLowerCase()).toBe("polygon");
    expect(outline.getAttribute("points")!.split(" ").length).toBeGreaterThan(82);
    const deck = container.querySelector("[data-testid='hull-deck-edge']")!;
    expect(deck.getAttribute("points")).not.toBe(outline.getAttribute("points"));
  });

  it("draws the ram beak only for a ram bow", () => {
    expect(
      draw(<HullShapeLayer frame={frame} />).container.querySelector("[data-testid='hull-ram']"),
    ).not.toBeNull();
    const spoon = planFrame(reference.draft.hull, {
      waterplaneCoeffBp: form.waterplaneCoeffBp,
      lcbPermille: form.lcbPermille,
      bow: "spoon",
      stern: "counter",
    });
    expect(
      draw(<HullShapeLayer frame={spoon} />).container.querySelector("[data-testid='hull-ram']"),
    ).toBeNull();
  });
});

describe("HullOutlineLayer", () => {
  it("adds the centreline, station ticks and the LCB mark over the hull shape", () => {
    const { container } = draw(<HullOutlineLayer frame={frame} />);
    expect(container.querySelector("[data-testid='hull-outline']")).not.toBeNull();
    const ticks = Array.from(container.querySelectorAll("line")).filter(
      (l) =>
        l.getAttribute("y2") === String(PLAN_MID + 3) &&
        l.getAttribute("y1") === String(PLAN_MID - 3),
    );
    expect(ticks).toHaveLength(9);
    const lcb = container.querySelector("[data-testid='hull-lcb']")!;
    expect(lcb.querySelector("title")!.textContent).toContain(`${frame.lcbPermille}‰`);
  });

  it("labels the bow, stern and the beam sides for orientation", () => {
    const { container } = draw(<HullOutlineLayer frame={frame} />);
    const texts = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(texts).toContain("bow");
    expect(texts).toContain("stern");
    expect(texts.some((t) => t?.includes("starboard") && t.includes("port"))).toBe(true);
  });
});

describe("HullZoneLayer", () => {
  it("marks the start of every real zone, excluding the MISSION overlay", () => {
    const { container } = draw(<HullZoneLayer frame={frame} zones={form.zones} />);
    const markers = container.querySelectorAll("g");
    const expected = form.zones.filter(
      (z) => (ZONE_IDS as readonly string[]).includes(z.id) && z.id !== "MISSION",
    );
    expect(markers).toHaveLength(expected.length);
  });

  it("ignores ids the catalogue does not know as zones", () => {
    const { container } = draw(
      <HullZoneLayer
        frame={frame}
        zones={[{ id: "NOT_A_ZONE", startPermille: 0, endPermille: 100 }]}
      />,
    );
    expect(container.querySelectorAll("g")).toHaveLength(0);
  });
});

describe("HullDeckLayer", () => {
  it("fills the deck edge inside the hull outline and ignores the pointer", () => {
    const { container } = draw(<HullDeckLayer frame={frame} />);
    const deck = container.querySelector("[data-testid='hull-deck-fill']")!;
    expect(deck.getAttribute("class")).toMatch(/pointer-events-none/);
    expect(deck.getAttribute("points")).toBeTruthy();
  });

  it("tones the hull side as a ring between the outline and the deck edge", () => {
    const { container } = draw(<HullDeckLayer frame={frame} />);
    const band = container.querySelector("[data-testid='hull-side-band']")!;
    expect(band.getAttribute("class")).toMatch(/pointer-events-none/);
    expect(band.getAttribute("fill-rule")).toBe("evenodd");
    // Two closed sub-paths: the outer plating edge and the inner deck edge.
    expect(band.getAttribute("d")!.match(/M/g)).toHaveLength(2);
  });
});

describe("hull ends from above", () => {
  const outlineXs = (bow: "ram" | "spoon" | "plumb", stern: "counter" | "transom" | "round") => {
    const f = planFrame(reference.draft.hull, {
      waterplaneCoeffBp: form.waterplaneCoeffBp,
      lcbPermille: form.lcbPermille,
      bow,
      stern,
    });
    const { container } = draw(<HullShapeLayer frame={f} />);
    const pts = container
      .querySelector("[data-testid='hull-outline']")!
      .getAttribute("points")!
      .split(" ")
      .map((p) => Number(p.split(",")[0]));
    return { f, min: Math.min(...pts), max: Math.max(...pts) };
  };

  it("rounds a counter or round stern past the stern station and leaves a transom flat", () => {
    for (const stern of ["counter", "round"] as const) {
      const { f, max } = outlineXs("ram", stern);
      expect(max).toBeGreaterThan(f.x(1000));
    }
    const flat = outlineXs("ram", "transom");
    expect(flat.max).toBeCloseTo(flat.f.x(1000), 6);
  });

  it("rounds a spoon bow ahead of the stem station and leaves a plumb bow flat", () => {
    const spoon = outlineXs("spoon", "transom");
    expect(spoon.min).toBeLessThan(spoon.f.x(0));
    const plumb = outlineXs("plumb", "transom");
    expect(plumb.min).toBeCloseTo(plumb.f.x(0), 6);
  });

  it("keeps the rounded ends inside the drawing's padding", () => {
    const { max, min } = outlineXs("spoon", "counter");
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(640);
  });
});
