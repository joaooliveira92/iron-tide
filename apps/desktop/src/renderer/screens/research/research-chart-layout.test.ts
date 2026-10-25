import { describe, expect, it } from "vite-plus/test";
import {
  CHART_GAP_X,
  CHART_NODE_HEIGHT,
  CHART_NODE_WIDTH,
  CHART_PADDING,
  layoutFieldChart,
  relatedTechIds,
} from "./research-chart-layout.js";

const spec = (techId: string, prerequisiteIds: string[] = [], cost = 100) => ({
  techId,
  prerequisiteIds,
  cost,
});

describe("layoutFieldChart", () => {
  const techs = [
    spec("a", [], 50),
    spec("b", ["a"], 120),
    spec("c", ["a"], 140),
    spec("d", ["b"], 150),
    spec("e", ["d", "c"], 300),
  ];

  it("places each technology one tier right of its deepest in-field prerequisite", () => {
    const tiers = Object.fromEntries(layoutFieldChart(techs).nodes.map((n) => [n.techId, n.tier]));
    expect(tiers).toEqual({ a: 0, b: 1, c: 1, d: 2, e: 3 });
  });

  it("orders siblings by cost and keeps children near their parents", () => {
    const rows = Object.fromEntries(layoutFieldChart(techs).nodes.map((n) => [n.techId, n.row]));
    expect(rows["b"]).toBe(0);
    expect(rows["c"]).toBe(1);
    expect(rows["d"]).toBe(0);
  });

  it("draws one edge per in-field prerequisite from the right of the parent to the left of the child", () => {
    const layout = layoutFieldChart(techs);
    expect(layout.edges).toHaveLength(5);
    const ab = layout.edges.find((e) => e.fromId === "a" && e.toId === "b");
    const a = layout.nodes.find((n) => n.techId === "a")!;
    const b = layout.nodes.find((n) => n.techId === "b")!;
    expect(ab?.path.startsWith(`M ${a.x + CHART_NODE_WIDTH} ${a.y + CHART_NODE_HEIGHT / 2}`)).toBe(
      true,
    );
    expect(ab?.path.endsWith(`${b.x} ${b.y + CHART_NODE_HEIGHT / 2}`)).toBe(true);
  });

  it("keeps cross-field prerequisites out of the edges and reports them as external", () => {
    const layout = layoutFieldChart([spec("x", ["other_field_tech"])]);
    expect(layout.edges).toHaveLength(0);
    expect(layout.nodes[0]?.externalPrerequisiteIds).toEqual(["other_field_tech"]);
    expect(layout.nodes[0]?.tier).toBe(0);
  });

  it("sizes the canvas to the tiers and rows", () => {
    const layout = layoutFieldChart(techs);
    expect(layout.width).toBe(CHART_PADDING * 2 + 4 * CHART_NODE_WIDTH + 3 * CHART_GAP_X);
    expect(layoutFieldChart([]).width).toBe(CHART_PADDING * 2);
  });

  it("survives a prerequisite cycle without recursing forever", () => {
    expect(() => layoutFieldChart([spec("p", ["q"]), spec("q", ["p"])])).not.toThrow();
  });
});

describe("relatedTechIds", () => {
  it("collects the whole ancestor and descendant chain but not siblings", () => {
    const layout = layoutFieldChart([
      spec("a"),
      spec("b", ["a"]),
      spec("c", ["a"]),
      spec("d", ["b"]),
    ]);
    expect([...relatedTechIds(layout, "b")].sort()).toEqual(["a", "b", "d"]);
  });
});
