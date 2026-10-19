import type { DesignDraft } from "@bluewave/ship-design";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { HullTopsideLayer } from "./HullTopsideLayer.js";
import { content, frame, hullForm as form } from "./test-fixtures.js";

const sup = form.zones.find((z) => z.id === "SUPERSTRUCTURE")!;
const funnel = content.catalogue.find((c) => c.tags.includes("funnel"))!;
const draft = {
  placements: [
    { instanceId: "f1", componentId: funnel.id, zoneId: "CENTRAL_MACHINERY", stationPermille: 560 },
  ],
} as unknown as DesignDraft;
const draw = (zones: readonly { id: string; startPermille: number; endPermille: number }[]) =>
  render(
    <svg>
      <HullTopsideLayer frame={frame} draft={draft} content={content} zones={zones} />
    </svg>,
  );

describe("HullTopsideLayer", () => {
  it("draws a superstructure footprint over its zone, marked as schematic", () => {
    const { container } = draw(form.zones);
    const rect = container.querySelector("[data-testid='hull-superstructure']")!;
    expect(Number(rect.getAttribute("x"))).toBeCloseTo(frame.x(sup.startPermille), 6);
    expect(Number(rect.getAttribute("width"))).toBeCloseTo(
      frame.x(sup.endPermille) - frame.x(sup.startPermille),
      6,
    );
    expect(rect.querySelector("title")!.textContent).toMatch(/schematic/i);
  });

  it("still draws funnels when the hull form has no superstructure zone", () => {
    const { container } = draw([]);
    expect(container.querySelector("[data-testid='hull-superstructure']")).toBeNull();
    expect(container.querySelectorAll("[data-testid='hull-funnel']")).toHaveLength(1);
    const ellipse = container.querySelector("[data-testid='hull-funnel']")!;
    expect(Number(ellipse.getAttribute("cx"))).toBeCloseTo(frame.x(560), 6);
  });
});

describe("HullTopsideLayer detail", () => {
  it("adds a bridge wedge to the superstructure and a dark uptake bore to each funnel", () => {
    const { container } = draw(form.zones);
    expect(container.querySelector("[data-testid='hull-bridge']")).not.toBeNull();
    expect(container.querySelectorAll("[data-testid='hull-funnel-bore']")).toHaveLength(1);
  });

  it("stands a foremast at the bridge and a mainmast at the aft end, and none without a superstructure", () => {
    const { container } = draw(form.zones);
    const xs = Array.from(container.querySelectorAll("[data-testid='hull-mast'] line")).map((l) =>
      Number(l.getAttribute("x1")),
    );
    const span = sup.endPermille - sup.startPermille;
    expect(xs).toHaveLength(2);
    expect(xs[0]).toBeCloseTo(frame.x(Math.round(sup.startPermille + span * 0.2)), 6);
    expect(xs[1]).toBeCloseTo(frame.x(sup.endPermille), 6);
    expect(draw([]).container.querySelectorAll("[data-testid='hull-mast']")).toHaveLength(0);
  });
});
