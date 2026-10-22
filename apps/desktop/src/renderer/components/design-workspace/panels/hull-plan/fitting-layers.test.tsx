import type { DesignDraft } from "@bluewave/ship-design";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { planFrame } from "./geometry.js";
import type { PlanSymbolSpec } from "./plan-symbols.js";
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
  const gun: PlanSymbolSpec = { shape: "gun", mountClass: "TURRET", barrels: 2, radius: 4 };
  const symbolOf = (p: { componentId: string }): PlanSymbolSpec =>
    p.componentId === "gun" ? gun : { shape: "tube" };

  it("draws each fitting as its symbol, still anchored by a data-fitting circle", () => {
    const { container } = draw(<HullFittingLayer frame={frame} draft={d} symbolOf={symbolOf} />);
    expect(container.querySelector("[data-kind='gun']")).not.toBeNull();
    expect(container.querySelector("[data-kind='torpedo']")).not.toBeNull();
    expect(container.querySelectorAll("circle[data-fitting]")).toHaveLength(2);
  });

  it("draws one barrel per gun of a multi-gun turret", () => {
    const triple: PlanSymbolSpec = { ...gun, barrels: 3 } as PlanSymbolSpec;
    const { container } = draw(
      <HullFittingLayer frame={frame} draft={d} symbolOf={() => triple} />,
    );
    expect(container.querySelector("[data-kind='gun']")!.querySelectorAll("line")).toHaveLength(3);
  });

  it("points a forward gun's barrels toward the bow and an aft gun's toward the stern", () => {
    const both = draft([
      { instanceId: "f", componentId: "gun", zoneId: "FORECASTLE", stationPermille: 100 },
      { instanceId: "a", componentId: "gun", zoneId: "AFT_SERVICE", stationPermille: 900 },
    ] as DesignDraft["placements"]);
    const { container } = draw(<HullFittingLayer frame={frame} draft={both} symbolOf={symbolOf} />);
    const [fwd, aft] = Array.from(container.querySelectorAll("[data-kind='gun']"));
    const barrel = (g: Element) => g.querySelector("line")!;
    expect(Number(barrel(fwd!).getAttribute("x2"))).toBeLessThan(
      Number(barrel(fwd!).getAttribute("x1")),
    );
    expect(Number(barrel(aft!).getAttribute("x2"))).toBeGreaterThan(
      Number(barrel(aft!).getAttribute("x1")),
    );
  });

  it("points a wing mount's barrels across the beam, outward on its own side", () => {
    const wings = draft([
      {
        instanceId: "s",
        componentId: "gun",
        zoneId: "SUPERSTRUCTURE",
        stationPermille: 500,
        side: "STBD",
      },
      {
        instanceId: "p",
        componentId: "gun",
        zoneId: "SUPERSTRUCTURE",
        stationPermille: 500,
        side: "PORT",
      },
    ] as DesignDraft["placements"]);
    const { container } = draw(
      <HullFittingLayer frame={frame} draft={wings} symbolOf={symbolOf} />,
    );
    const [stbd, port] = Array.from(container.querySelectorAll("[data-kind='gun']"));
    for (const barrel of Array.from(stbd!.querySelectorAll("line"))) {
      expect(barrel.getAttribute("x2")).toBe(barrel.getAttribute("x1"));
      expect(Number(barrel.getAttribute("y2"))).toBeLessThan(Number(barrel.getAttribute("y1")));
    }
    for (const barrel of Array.from(port!.querySelectorAll("line"))) {
      expect(barrel.getAttribute("x2")).toBe(barrel.getAttribute("x1"));
      expect(Number(barrel.getAttribute("y2"))).toBeGreaterThan(Number(barrel.getAttribute("y1")));
    }
    expect(
      new Set(Array.from(stbd!.querySelectorAll("line")).map((l) => l.getAttribute("x1"))).size,
    ).toBe(2);
  });

  it("draws a casemate as a hull-side box with no barrel", () => {
    const casemate: PlanSymbolSpec = {
      shape: "gun",
      mountClass: "CASEMATE",
      barrels: 1,
      radius: 3,
    };
    const { container } = draw(
      <HullFittingLayer frame={frame} draft={d} symbolOf={() => casemate} />,
    );
    expect(container.querySelector("[data-mount-class='CASEMATE'] rect")).not.toBeNull();
    expect(container.querySelector("[data-mount-class='CASEMATE'] line")).toBeNull();
  });
});

describe("GunArcLayer focus", () => {
  const d = draft([
    { instanceId: "m", componentId: "gun", zoneId: "FORECASTLE", stationPermille: 300 },
  ] as DesignDraft["placements"]);
  const mounts = [{ instanceId: "m", effectiveBeamArcDeg: 120 }];

  it("draws a larger wedge when given a larger radius", () => {
    const reach = (r?: number) => {
      const { container } = draw(
        <GunArcLayer frame={frame} draft={d} mounts={mounts} radius={r} />,
      );
      const nums = container
        .querySelector("[data-arc]")!
        .getAttribute("d")!
        .match(/-?\d+(\.\d+)?/g)!
        .map(Number);
      return Math.max(...nums) - Math.min(...nums);
    };
    expect(reach(48)).toBeGreaterThan(reach());
  });

  it("writes each wedge's width only when labelled", () => {
    const plain = draw(<GunArcLayer frame={frame} draft={d} mounts={mounts} />);
    expect(plain.container.querySelectorAll("[data-arc-label]")).toHaveLength(0);
    plain.unmount();
    const { container } = draw(<GunArcLayer frame={frame} draft={d} mounts={mounts} labelled />);
    expect(
      Array.from(container.querySelectorAll("[data-arc-label]")).map((t) => t.textContent),
    ).toEqual(["120°", "120°"]);
  });
});
