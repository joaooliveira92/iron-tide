import type { DesignDraft } from "@bluewave/ship-design";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { planFrame } from "./geometry.js";
import { GunArcLayer, HullFittingLayer } from "./fitting-layers.js";

const frame = planFrame({ lengthWl: 100_000, beam: 14_000 } as never);
const draft = (placements: DesignDraft["placements"]): DesignDraft =>
  ({ placements }) as unknown as DesignDraft;
const draw = (ui: React.ReactNode) => render(<svg>{ui}</svg>);

describe("HullFittingLayer", () => {
  const d = draft([
    { instanceId: "a", componentId: "gun_a", zoneId: "FORECASTLE", stationPermille: 100 },
    {
      instanceId: "b",
      componentId: "gun_b",
      zoneId: "AFT_SERVICE",
      stationPermille: 800,
      side: "PORT",
    },
  ] as DesignDraft["placements"]);

  it("marks every placement with a dot carrying its instance id", () => {
    const { container } = draw(<HullFittingLayer frame={frame} draft={d} />);
    expect(
      Array.from(container.querySelectorAll("[data-fitting]")).map((el) =>
        el.getAttribute("data-fitting"),
      ),
    ).toEqual(["a", "b"]);
  });

  it("rings only the fitting being moved", () => {
    const { container } = draw(<HullFittingLayer frame={frame} draft={d} selectedId="b" />);
    const ring = container.querySelector("[data-testid='plan-selected-ring']")!;
    expect(ring).not.toBeNull();
    expect(container.querySelectorAll("[data-testid='plan-selected-ring']")).toHaveLength(1);
    // The ring sits on b's dot, which is below the centreline (port).
    const dot = container.querySelector("[data-fitting='b']")!;
    expect(ring.getAttribute("cx")).toBe(dot.getAttribute("cx"));
    expect(ring.getAttribute("cy")).toBe(dot.getAttribute("cy"));
  });
});

describe("GunArcLayer", () => {
  const d = draft([
    { instanceId: "mount", componentId: "gun", zoneId: "FORECASTLE", stationPermille: 300 },
  ] as DesignDraft["placements"]);

  it("draws one wedge per beam for a centreline mount, labelled with its width", () => {
    const { container } = draw(
      <GunArcLayer
        frame={frame}
        draft={d}
        mounts={[{ instanceId: "mount", effectiveBeamArcDeg: 120 }]}
      />,
    );
    const arcs = container.querySelectorAll("[data-arc]");
    expect(Array.from(arcs).map((a) => a.getAttribute("data-arc"))).toEqual([
      "mount:STBD",
      "mount:PORT",
    ]);
    expect(arcs[0]!.querySelector("title")!.textContent).toMatch(/120° starboard beam arc/);
    // The main plan's schematic arc radius is 30 plan units (the section card draws its own at 26).
    expect(arcs[0]!.getAttribute("d")).toMatch(/A 30 30/);
  });

  it("draws nothing for a placement with no mount arc", () => {
    const { container } = draw(<GunArcLayer frame={frame} draft={d} mounts={[]} />);
    expect(container.querySelectorAll("[data-arc]")).toHaveLength(0);
  });
});

describe("HullFittingLayer symbols", () => {
  const d = draft([
    { instanceId: "g", componentId: "gun", zoneId: "FORECASTLE", stationPermille: 100 },
    { instanceId: "t", componentId: "tube", zoneId: "AFT_SERVICE", stationPermille: 800 },
  ] as DesignDraft["placements"]);
  const kindOf = (id: string) => (id === "gun" ? "gun" : "torpedo");

  it("draws each fitting as its kind's symbol, still anchored by a data-fitting circle", () => {
    const { container } = draw(<HullFittingLayer frame={frame} draft={d} kindOf={kindOf} />);
    expect(container.querySelector("[data-kind='gun']")).not.toBeNull();
    expect(container.querySelector("[data-kind='torpedo']")).not.toBeNull();
    expect(container.querySelectorAll("circle[data-fitting]")).toHaveLength(2);
  });

  it("points a forward gun's barrels toward the bow and an aft gun's toward the stern", () => {
    const both = draft([
      { instanceId: "f", componentId: "gun", zoneId: "FORECASTLE", stationPermille: 100 },
      { instanceId: "a", componentId: "gun", zoneId: "AFT_SERVICE", stationPermille: 900 },
    ] as DesignDraft["placements"]);
    const { container } = draw(<HullFittingLayer frame={frame} draft={both} kindOf={kindOf} />);
    const [fwd, aft] = Array.from(container.querySelectorAll("[data-kind='gun']"));
    const barrel = (g: Element) => g.querySelector("line")!;
    expect(Number(barrel(fwd!).getAttribute("x2"))).toBeLessThan(
      Number(barrel(fwd!).getAttribute("x1")),
    );
    expect(Number(barrel(aft!).getAttribute("x2"))).toBeGreaterThan(
      Number(barrel(aft!).getAttribute("x1")),
    );
  });
});
