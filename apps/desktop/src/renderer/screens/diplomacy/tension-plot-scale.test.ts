import { describe, expect, it } from "vite-plus/test";
import type { PlotNode } from "./diplomacy-plot.js";
import type { DiplomacyRelationRow } from "./diplomacy-view-model.js";
import {
  BEARING_DEGREES,
  TICK_DEGREES,
  bearingLabelAt,
  blockadeMarkerStyle,
  contactLabelPlacement,
  linkClass,
  linkDash,
  linkWidth,
  plotFrameStyle,
  tickSegment,
} from "./tension-plot-scale.js";

type LinkFlags = Pick<DiplomacyRelationRow, "atWar" | "allied" | "nap">;

function flags(overrides: Partial<LinkFlags>): DiplomacyRelationRow {
  const base: LinkFlags = { atWar: false, allied: false, nap: false, ...overrides };
  return base as DiplomacyRelationRow;
}

function node(id: string, x: number, y: number, angle: number, radius: number): PlotNode {
  return { id, name: id, code: id.toUpperCase(), x, y, angle, radius };
}

describe("link styling", () => {
  it("ranks war over alliance over pact over plain", () => {
    const war = flags({ atWar: true, allied: true, nap: true });
    const allied = flags({ allied: true, nap: true });
    const pact = flags({ nap: true });
    const plain = flags({});
    expect([war, allied, pact, plain].map(linkClass)).toEqual([
      "stroke-destructive",
      "stroke-success",
      "stroke-muted-foreground",
      "stroke-border",
    ]);
    expect([war, allied, pact, plain].map(linkWidth)).toEqual([3, 2.5, 1.5, 1]);
    expect([war, allied, pact, plain].map(linkDash)).toEqual([undefined, undefined, "6 5", "2 5"]);
  });
});

describe("bearing ticks", () => {
  it("steps every ten degrees with a bearing label every thirty", () => {
    expect(TICK_DEGREES).toHaveLength(36);
    expect(TICK_DEGREES[0]).toBe(0);
    expect(TICK_DEGREES[35]).toBe(350);
    expect(BEARING_DEGREES).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
  });

  it("draws major ticks longer than minor ones", () => {
    expect(tickSegment(0)).toEqual({
      degrees: 0,
      from: { x: 320, y: 52 },
      to: { x: 320, y: 38 },
    });
    expect(tickSegment(10).to).toEqual({ x: 367.8, y: 49.2 });
    expect(bearingLabelAt(0)).toEqual({ left: "50%", top: "6.470000000000001%" });
  });
});

describe("contact labels", () => {
  it("centres a label straight above or below and otherwise pushes it outward", () => {
    expect(contactLabelPlacement(node("n", 320, 100, -90, 220))).toMatchObject({
      side: "left",
      shiftClass: "-translate-x-1/2",
    });
    expect(contactLabelPlacement(node("e", 500, 320, 0, 180))).toMatchObject({
      side: "right",
      shiftClass: "translate-x-0",
    });
    expect(contactLabelPlacement(node("w", 140, 320, 180, 180))).toMatchObject({
      side: "left",
      shiftClass: "-translate-x-full",
    });
  });

  it("offsets the label by the outward gap", () => {
    expect(contactLabelPlacement(node("e", 500, 320, 0, 180)).style).toEqual({
      left: "74.42%",
      top: "50%",
    });
  });
});

describe("plot frame and blockade marker", () => {
  it("derives the frame from the plot aspect ratio", () => {
    expect(plotFrameStyle()).toEqual({
      aspectRatio: "860 / 680",
      maxWidth: `${(28 * 860) / 680}rem`,
    });
  });

  it("puts the blockade marker halfway along the link", () => {
    expect(blockadeMarkerStyle(node("e", 500, 320, 0, 180))).toEqual({
      left: "60.470000000000006%",
      top: "50%",
    });
  });
});
