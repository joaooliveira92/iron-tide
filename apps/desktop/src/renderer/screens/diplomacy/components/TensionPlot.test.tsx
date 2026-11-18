import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { DiplomacyRelationRow } from "../diplomacy-view-model.js";
import { DEFAULT_PLOT_LAYERS, type PlotLayer } from "./plot-layers.js";
import { TensionPlot } from "./TensionPlot.js";

function row(
  id: string,
  name: string,
  overrides: Partial<DiplomacyRelationRow> = {},
): DiplomacyRelationRow {
  return {
    flagUrl: null,
    relation: "neutral",
    band: "neutral",
    atWar: false,
    allied: false,
    blockades: [],
    partnerNationId: id,
    partnerName: name,
    since: "",
    relationLabel: "Neutral",
    tension: 4,
    tensionBadge: null,
    nap: false,
    isLikelyRival: false,
    highTension: false,
    highTensionNote: "",
    actions: [],
    ...overrides,
  };
}

const BLOCKADE = {
  key: "b",
  blockaderName: "France",
  blockadedName: "Spain",
  areaLabel: "Biscay",
  establishedMonth: "1880-01",
};

const rows = [
  row("brazil", "Empire of Brazil", { atWar: true, band: "war_imminent", tension: 9 }),
  row("france", "France", { allied: true, band: "cordial", tension: 1 }),
  row("spain", "Spain", { nap: true, tension: 5, blockades: [BLOCKADE] }),
  row("italy", "Kingdom of Italy", { tension: 7, band: "hostile" }),
];

function renderPlot(layers: ReadonlySet<PlotLayer>, selectedId: string | null = null) {
  return render(
    <TensionPlot
      rows={rows}
      playerFlagUrl={null}
      records={new Map()}
      selectedId={selectedId}
      layers={layers}
      onSelect={() => undefined}
    />,
  );
}

function attrs(element: Element, names: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(names.map((name) => [name, element.getAttribute(name)]));
}

describe("TensionPlot rendering", () => {
  afterEach(cleanup);

  it("sizes the frame from the plot aspect ratio", () => {
    const { getByTestId } = renderPlot(DEFAULT_PLOT_LAYERS);
    const frame = getByTestId("tension-plot");
    expect(frame.style.aspectRatio).toBe("860 / 680");
    expect(frame.style.maxWidth).toBe(`${(28 * 860) / 680}rem`);
  });

  it("draws one link per nation with war, alliance and pact styling", () => {
    const { container } = renderPlot(DEFAULT_PLOT_LAYERS);
    const links = [...container.querySelectorAll("svg > line")].map((line) => ({
      ...attrs(line, ["x2", "y2", "stroke-width", "stroke-dasharray", "stroke-linecap"]),
      class: line.getAttribute("class"),
    }));
    const link = (x2: string, y2: string, width: string, dash: string | null, tone: string) => ({
      x2,
      y2,
      "stroke-width": width,
      "stroke-dasharray": dash,
      "stroke-linecap": "round",
      class: tone,
    });
    expect(links).toEqual([
      link("379.3", "260.7", "3", null, "stroke-destructive"),
      link("491.3", "491.3", "2.5", null, "stroke-success"),
      link("232.7", "407.3", "1", "2 5", "stroke-border"),
      link("204.7", "204.7", "1.5", "6 5", "stroke-muted-foreground"),
    ]);
  });

  it("places each contact and marks the selected one", () => {
    const { container } = renderPlot(DEFAULT_PLOT_LAYERS, "spain");
    const contacts = [...container.querySelectorAll("button[data-nation-id]")].map((button) => [
      button.getAttribute("data-nation-id"),
      button.getAttribute("style"),
      button.getAttribute("aria-pressed"),
    ]);
    expect(contacts).toEqual([
      ["brazil", "left: 56.9%; top: 41.28%;", "false"],
      ["france", "left: 69.92%; top: 75.19%;", "false"],
      ["italy", "left: 39.85%; top: 62.839999999999996%;", "false"],
      ["spain", "left: 36.589999999999996%; top: 33.04%;", "true"],
    ]);
    expect(container.querySelector("button[data-nation-id=spain]")?.className).toContain(
      "ring-primary",
    );
    expect(container.querySelector("button[data-nation-id=brazil]")?.className).toContain(
      "motion-safe:animate-pulse",
    );
  });

  it("places and aligns nation labels by which side of the centre they sit on", () => {
    const { container } = renderPlot(DEFAULT_PLOT_LAYERS, "spain");
    const labels = [...container.querySelectorAll("span.whitespace-nowrap")].map((label) => ({
      text: label.textContent,
      style: label.getAttribute("style"),
      shift: ["-translate-x-1/2", "translate-x-0", "-translate-x-full"].filter((name) =>
        label.className.split(" ").includes(name),
      ),
      selected: label.className.includes("font-semibold text-foreground"),
    }));
    expect(labels).toEqual([
      {
        text: "Brazil",
        style: "left: 59.36%; top: 38.160000000000004%;",
        shift: ["translate-x-0"],
        selected: false,
      },
      {
        text: "France",
        style: "left: 72.38%; top: 78.31%;",
        shift: ["translate-x-0"],
        selected: false,
      },
      {
        text: "Italy",
        style: "left: 37.38%; top: 65.96000000000001%;",
        shift: ["-translate-x-full"],
        selected: false,
      },
      {
        text: "Spain",
        style: "left: 34.13%; top: 29.93%;",
        shift: ["-translate-x-full"],
        selected: true,
      },
    ]);
  });

  it("marks a blockaded nation halfway along its link and labels the bearings", () => {
    const { container } = renderPlot(DEFAULT_PLOT_LAYERS);
    const markers = [...container.querySelectorAll("span.border-destructive")];
    expect(markers.map((marker) => marker.getAttribute("style"))).toEqual([
      "left: 43.3%; top: 41.53%;",
    ]);
    const bearings = [...container.querySelectorAll("span.tabular-nums")].map((label) => [
      label.textContent,
      label.getAttribute("style"),
    ]);
    expect(bearings).toHaveLength(12);
    expect(bearings[0]).toEqual(["000", "left: 50%; top: 6.470000000000001%;"]);
    expect(bearings[1]).toEqual(["030", "left: 67.21000000000001%; top: 12.309999999999999%;"]);
    expect(bearings[11]).toEqual(["330", "left: 32.79%; top: 12.309999999999999%;"]);
  });

  it("draws the ring ticks as 36 bearing lines with every third one longer", () => {
    const { container } = renderPlot(DEFAULT_PLOT_LAYERS);
    const ticks = [...container.querySelectorAll("svg g > line.stroke-muted-foreground\\/50")];
    expect(ticks).toHaveLength(36);
    expect(attrs(ticks[0]!, ["x1", "y1", "x2", "y2"])).toEqual({
      x1: "320",
      y1: "52",
      x2: "320",
      y2: "38",
    });
    expect(attrs(ticks[1]!, ["x1", "y1", "x2", "y2"])).toEqual({
      x1: "366.5",
      y1: "56.1",
      x2: "367.8",
      y2: "49.2",
    });
  });

  it("omits each layer when it is switched off", () => {
    const none = renderPlot(new Set<PlotLayer>());
    expect(none.container.querySelectorAll("svg > line")).toHaveLength(0);
    expect(none.container.querySelectorAll("svg > g")).toHaveLength(0);
    expect(none.container.querySelectorAll("span.border-destructive")).toHaveLength(0);
    expect(none.container.querySelectorAll("span.whitespace-nowrap")).toHaveLength(0);
    expect(none.container.querySelectorAll("ul[aria-label='Tension rings']")).toHaveLength(0);
    expect(none.container.querySelectorAll("button[data-nation-id]")).toHaveLength(4);
  });
});
