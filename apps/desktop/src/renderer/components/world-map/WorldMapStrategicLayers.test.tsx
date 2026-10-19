import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { WorldMapChart, type WorldMapChartProps } from "./WorldMapChart.js";
import { AREAS, EDGES, FLEETS } from "./fixture-world.js";
import type { LiveWorldMapOverlay } from "./campaign-map-join.js";
import {
  initialMapPrototypeState,
  nationName,
  readRoute,
  type MapPrototypeState,
} from "./map-state.js";
import { buildRegionStrengths } from "./map-strength.js";

const noop = () => undefined;

function chart(overrides: Partial<WorldMapChartProps> = {}) {
  return (
    <WorldMapChart
      state={initialMapPrototypeState}
      route={null}
      onSelect={noop}
      onRuler={noop}
      onToggleLayer={noop}
      onSetProjection={noop}
      onSetCentre={noop}
      onToggleClosedPassages={noop}
      {...overrides}
    />
  );
}

function withState(patch: Partial<MapPrototypeState>): MapPrototypeState {
  return { ...initialMapPrototypeState, ...patch };
}

/** The home copy of a decorative layer (the chart draws one copy per world turn). */
function homeLayer(container: HTMLElement, layer: string): Element | null {
  return container.querySelector(`[data-layer="${layer}"]`);
}

const UNGATED_LANES = new Set(
  EDGES.filter((edge) => edge.passage === undefined).map((edge) =>
    [edge.a, edge.b].sort().join("~"),
  ),
);

describe("strategic map: route-free start", () => {
  afterEach(cleanup);

  it("opens with no route drawn and no hop, distance or time readout", () => {
    const { container } = render(chart());
    expect(container.querySelector('path[stroke-dasharray="10 6"]')).toBeNull();
    expect(container.textContent).not.toMatch(/\bhops?\b/i);
    expect(container.textContent).not.toMatch(/\bnm\b.*\bmonths?\b/i);
  });
});

describe("strategic map: sea lanes", () => {
  afterEach(cleanup);

  it("draws one lane per ungated edge of the route graph", () => {
    const { container } = render(chart());
    const lanes = [...(homeLayer(container, "lanes")?.querySelectorAll("line") ?? [])];
    expect(lanes).toHaveLength(UNGATED_LANES.size);
  });

  it("is purely decorative: hidden from assistive tech and transparent to the pointer", () => {
    const { container } = render(chart());
    const layer = homeLayer(container, "lanes");
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(layer?.getAttribute("pointer-events")).toBe("none");
  });

  it("can be switched off with its layer toggle", () => {
    const state = withState({ layers: { ...initialMapPrototypeState.layers, lanes: false } });
    const { container } = render(chart({ state }));
    expect(homeLayer(container, "lanes")).toBeNull();
  });

  it("stays a passive layer: with no route there is no route line, and a route is drawn apart from the lanes", () => {
    const state = withState({ rulerFrom: "area_north_sea", rulerTo: "area_western_approaches" });
    const route = readRoute(state);
    expect(route).not.toBeNull();
    const { container } = render(chart({ state, route }));
    const routeLines = container.querySelectorAll('path[stroke-dasharray="10 6"]');
    expect(routeLines.length).toBeGreaterThan(0);
    // No lane carries the route's styling, and no route line lives inside the lane layer.
    const lanes = homeLayer(container, "lanes");
    expect(lanes?.getAttribute("stroke-dasharray")).not.toBe("10 6");
    expect(lanes?.querySelector('path[stroke-dasharray="10 6"]')).toBeNull();
  });

  it("is stable across rerenders", () => {
    const { container, rerender } = render(chart());
    const before = homeLayer(container, "lanes")?.innerHTML;
    rerender(chart({ onSelect: () => undefined }));
    expect(homeLayer(container, "lanes")?.innerHTML).toBe(before);
  });
});

describe("strategic map: regional strength", () => {
  afterEach(cleanup);

  const expected = buildRegionStrengths(
    FLEETS.map((fleet) => ({
      id: fleet.id,
      area: fleet.area,
      ships: fleet.ships,
      owner: fleet.owner,
    })),
    { nameFor: nationName, flagUrlFor: () => null },
  );

  it("draws one glyph per region that holds ships, each carrying that region's total", () => {
    const { container } = render(chart());
    const glyphs = [...(homeLayer(container, "strength")?.querySelectorAll("[data-region]") ?? [])];
    expect(glyphs.map((glyph) => glyph.getAttribute("data-region"))).toEqual(
      expected.map((region) => region.areaId),
    );
    expect(glyphs.map((glyph) => Number(glyph.getAttribute("data-ships")))).toEqual(
      expected.map((region) => region.total),
    );
  });

  it("draws no glyph for a region with no ships", () => {
    const { container } = render(chart());
    const drawn = new Set(
      [...container.querySelectorAll('[data-layer="strength"] [data-region]')].map((g) =>
        g.getAttribute("data-region"),
      ),
    );
    const empty = AREAS.filter((area) => !expected.some((region) => region.areaId === area.id));
    expect(empty.length).toBeGreaterThan(0);
    for (const area of empty) expect(drawn.has(area.id)).toBe(false);
  });

  it("is decorative and never intercepts the pointer", () => {
    const { container } = render(chart());
    for (const layer of container.querySelectorAll("[data-layer]")) {
      expect(layer.getAttribute("aria-hidden")).toBe("true");
      expect(layer.getAttribute("pointer-events")).toBe("none");
    }
  });

  it("follows the fleets layer toggle", () => {
    const state = withState({ layers: { ...initialMapPrototypeState.layers, fleets: false } });
    const { container } = render(chart({ state }));
    expect(homeLayer(container, "strength")).toBeNull();
  });

  it("gives screen readers the strength in words on the focusable area, in nation order", () => {
    const { container } = render(chart());
    const region = expected[0];
    expect(region).toBeDefined();
    const name = AREAS.find((area) => area.id === region?.areaId)?.name ?? "";
    const labels = [...container.querySelectorAll('path[role="button"]')].map((path) =>
      path.getAttribute("aria-label"),
    );
    const label = labels.find((text) => text?.startsWith(`${name}:`));
    expect(label).toMatch(new RegExp(`strength ${region?.total} ships? \\(`));
    for (const entry of region?.nations ?? [])
      expect(label).toContain(`${entry.name} ${entry.ships}`);
    // Areas without ships carry no strength sentence.
    const quiet = labels.filter((text) => !text?.includes("strength"));
    expect(quiet.length).toBe(AREAS.length - expected.length);
  });
});

describe("strategic map: area states", () => {
  afterEach(cleanup);

  const liveOverlay = (owned: readonly string[]): LiveWorldMapOverlay => ({
    source: "campaign",
    ownership: new Map(owned.map((id) => [id, "uk"])),
    fleets: [],
    ports: [],
    playerNationId: "uk",
    campaignAreas: [],
  });

  it("marks areas a live campaign has no data for, in the visuals and in words", () => {
    const { container } = render(chart({ overlay: liveOverlay(["area_north_sea"]) }));
    const paths = [...container.querySelectorAll('path[role="button"]')];
    const noData = paths.filter((path) => path.hasAttribute("data-unavailable"));
    expect(noData).toHaveLength(AREAS.length - 1);
    for (const path of noData) expect(path.getAttribute("aria-label")).toMatch(/no campaign data$/);
    const live = paths.find((path) => path.getAttribute("aria-label")?.startsWith("North Sea:"));
    expect(live?.hasAttribute("data-unavailable")).toBe(false);
    expect(live?.getAttribute("aria-label")).not.toMatch(/no campaign data/);
  });

  it("never marks fixture areas unavailable when no campaign is loaded", () => {
    const { container } = render(chart());
    expect(container.querySelector("[data-unavailable]")).toBeNull();
  });

  it("shows no strength for a live campaign with no fleets (zero or missing data)", () => {
    const { container } = render(chart({ overlay: liveOverlay(["area_north_sea"]) }));
    expect(container.querySelector('[data-layer="strength"] [data-region]')).toBeNull();
  });

  it("keeps selected, hovered and focused states on separate channels", () => {
    const { container } = render(chart({ state: withState({ selected: "area_north_sea" }) }));
    const paths = [...container.querySelectorAll('path[role="button"]')];
    const selected = paths.filter((path) => path.getAttribute("aria-pressed") === "true");
    expect(selected).toHaveLength(1);
    for (const path of paths) {
      expect(path.getAttribute("tabindex")).toBe("0");
      expect(path.getAttribute("class")).toMatch(/hover:\[stroke:var\(--map-hover\)\]/);
      expect(path.getAttribute("class")).toMatch(/focus-visible:\[stroke:var\(--map-focus\)\]/);
    }
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--map-hover")).not.toBe("");
    expect(root.style.getPropertyValue("--map-hover")).not.toBe(
      root.style.getPropertyValue("--map-focus"),
    );
  });
});
