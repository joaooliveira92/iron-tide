import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorldMapChart, type WorldMapChartProps } from "./WorldMapChart.js";
import { AREAS } from "./map-geometry.js";
import type { LiveWorldMapOverlay } from "./campaign-map-join.js";
import { initialMapPrototypeState, readRoute, type MapPrototypeState } from "./map-state.js";
import { buildRegionStrengths } from "./map-strength.js";
import type { MapOrders } from "./map-orders.js";

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
      {...overrides}
    />
  );
}

function withState(patch: Partial<MapPrototypeState>): MapPrototypeState {
  return { ...initialMapPrototypeState, ...patch };
}

function homeLayer(container: HTMLElement, layer: string): Element | null {
  return container.querySelector(`[data-layer="${layer}"]`);
}

function liveOverlay(patch: Partial<LiveWorldMapOverlay> = {}): LiveWorldMapOverlay {
  return {
    source: "campaign",
    ownership: new Map(),
    fleets: [],
    ports: [],
    lanes: [],
    campaignAreas: [],
    playerNationId: "uk",
    ...patch,
  };
}

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

  const overlay = liveOverlay({
    lanes: [
      { a: "area_north_sea", b: "area_western_approaches" },
      { a: "area_baltic", b: "area_north_sea" },
    ],
  });

  it("draws one lane per campaign sea route", () => {
    const { container } = render(chart({ overlay }));
    const lanes = [...(homeLayer(container, "lanes")?.querySelectorAll("line") ?? [])];
    expect(lanes).toHaveLength(2);
  });

  it("is purely decorative: hidden from assistive tech and transparent to the pointer", () => {
    const { container } = render(chart({ overlay }));
    const layer = homeLayer(container, "lanes");
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
    expect(layer?.getAttribute("pointer-events")).toBe("none");
  });

  it("can be switched off with its layer toggle", () => {
    const state = withState({ layers: { ...initialMapPrototypeState.layers, lanes: false } });
    const { container } = render(chart({ state, overlay }));
    expect(homeLayer(container, "lanes")).toBeNull();
  });

  it("stays a passive layer: with no route there is no route line, and a route is drawn apart from the lanes", () => {
    const state = withState({
      rulerFrom: "area_north_sea",
      rulerTo: "area_western_approaches",
    });
    const route = readRoute(state, overlay.lanes ?? []);
    expect(route).not.toBeNull();
    const { container } = render(chart({ state, route, overlay }));
    const routeLines = container.querySelectorAll('path[stroke-dasharray="10 6"]');
    expect(routeLines.length).toBeGreaterThan(0);
    const laneGroups = container.querySelectorAll('[data-layer="lanes"]');
    expect(laneGroups[0]?.querySelectorAll("line")).toHaveLength(2);
  });

  it("is stable across rerenders", () => {
    const { container, rerender } = render(chart({ overlay }));
    const before = homeLayer(container, "lanes")?.innerHTML;
    rerender(chart({ overlay, onSelect: () => undefined }));
    expect(homeLayer(container, "lanes")?.innerHTML).toBe(before);
  });
});

describe("strategic map: regional strength", () => {
  afterEach(cleanup);

  const overlay = liveOverlay({
    fleets: [
      { id: "home-fleet", name: "Home Fleet", area: "area_north_sea", nation: "uk", ships: 12 },
      {
        id: "channel-fleet",
        name: "Channel Fleet",
        area: "area_north_sea",
        nation: "uk",
        ships: 3,
      },
    ],
  });
  const expected = buildRegionStrengths(
    overlay.fleets.map((fleet) => ({
      id: fleet.id,
      area: fleet.area,
      ships: fleet.ships,
      owner: fleet.nation,
    })),
    { nameFor: () => "Britain", flagUrlFor: () => null },
  );

  it("draws one glyph per region that holds ships, each carrying that region's total", () => {
    const { container } = render(chart({ overlay }));
    const glyphs = [...(homeLayer(container, "strength")?.querySelectorAll("[data-region]") ?? [])];
    expect(glyphs.map((glyph) => glyph.getAttribute("data-region"))).toEqual(
      expected.map((region) => region.areaId),
    );
    expect(glyphs.map((glyph) => Number(glyph.getAttribute("data-ships")))).toEqual(
      expected.map((region) => region.total),
    );
  });

  it("draws no glyph for a region with no ships", () => {
    const { container } = render(chart({ overlay }));
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
    const { container } = render(chart({ overlay }));
    for (const layer of container.querySelectorAll("[data-layer]")) {
      expect(layer.getAttribute("aria-hidden")).toBe("true");
      expect(layer.getAttribute("pointer-events")).toBe("none");
    }
  });

  it("shortens its bars on a small map and keeps them full-size on a large one", async () => {
    const tallest = (container: HTMLElement) =>
      Math.max(
        ...[...container.querySelectorAll('[data-layer="strength"] [data-region]')].map((glyph) =>
          Math.max(
            ...[...glyph.querySelectorAll("rect")].map((rect) =>
              Number(rect.getAttribute("height")),
            ),
          ),
        ),
      );
    const height = vi.spyOn(Element.prototype, "clientHeight", "get");

    height.mockReturnValue(900);
    const large = render(chart({ overlay }));
    await waitFor(() => expect(large.container.querySelector("[data-compact]")).toBeNull());
    const fullBar = tallest(large.container);
    large.unmount();

    height.mockReturnValue(420);
    const small = render(chart({ overlay }));
    await waitFor(() => expect(small.container.querySelector("[data-compact]")).not.toBeNull());
    expect(tallest(small.container)).toBeLessThan(fullBar);
    height.mockRestore();
  });

  it("follows the fleets layer toggle", () => {
    const state = withState({ layers: { ...initialMapPrototypeState.layers, fleets: false } });
    const { container } = render(chart({ state, overlay }));
    expect(homeLayer(container, "strength")).toBeNull();
  });

  it("gives screen readers the strength in words on the focusable area", () => {
    const { container } = render(chart({ overlay }));
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
  });
});

describe("strategic map: area states", () => {
  afterEach(cleanup);

  it("marks every area as having no campaign data when no campaign is loaded", () => {
    const { container } = render(chart());
    const paths = [...container.querySelectorAll('path[role="button"]')];
    expect(paths.filter((path) => path.hasAttribute("data-unavailable"))).toHaveLength(
      AREAS.length,
    );
    for (const path of paths) expect(path.getAttribute("aria-label")).toMatch(/no campaign data$/);
  });

  it("marks only unmentioned areas when a campaign is loaded", () => {
    const { container } = render(
      chart({ overlay: liveOverlay({ ownership: new Map([["area_north_sea", "uk"]]) }) }),
    );
    const paths = [...container.querySelectorAll('path[role="button"]')];
    const noData = paths.filter((path) => path.hasAttribute("data-unavailable"));
    expect(noData).toHaveLength(AREAS.length - 1);
    const live = paths.find((path) => path.getAttribute("aria-label")?.startsWith("North Sea:"));
    expect(live?.hasAttribute("data-unavailable")).toBe(false);
  });

  it("shows no strength for a live campaign with no fleets (zero or missing data)", () => {
    const { container } = render(
      chart({ overlay: liveOverlay({ ownership: new Map([["area_north_sea", "uk"]]) }) }),
    );
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

describe("strategic map: fleet orders", () => {
  afterEach(cleanup);

  const overlay = liveOverlay({
    ownership: new Map([
      ["area_north_sea", "uk"],
      ["area_western_approaches", "uk"],
    ]),
    campaignAreas: [
      { id: "sea_north_sea", name: "North Sea", controller: "uk", fleets: [] },
      { id: "sea_western_approaches", name: "Western Approaches", controller: "uk", fleets: [] },
    ],
    fleets: [
      { id: "home-fleet", name: "Home Fleet", area: "area_north_sea", nation: "uk", ships: 12 },
    ],
  });

  function orders(patch: Partial<MapOrders> = {}): MapOrders {
    return {
      fleets: [
        {
          fleetId: "home-fleet",
          fleetName: "Home Fleet",
          areaId: "sea_north_sea",
          mapAreaId: "area_north_sea",
          areaName: "North Sea",
          shipCount: 12,
          legalDestinations: [
            {
              areaId: "sea_western_approaches",
              mapAreaId: "area_western_approaches",
              name: "Western Approaches",
            },
          ],
          blockedReason: null,
        },
      ],
      pending: [],
      blockadedMapAreas: new Set(),
      selectedFleetId: null,
      onSelectFleet: noop,
      onDrop: noop,
      ...patch,
    };
  }

  it("marks own fleets as draggable and never marks foreign ones", () => {
    const { container } = render(chart({ overlay, orders: orders() }));
    expect(container.querySelector('[data-map-fleet="home-fleet"]')).not.toBeNull();
    expect(container.querySelector('[data-draggable=""]')).not.toBeNull();
  });

  it("draws a pending order as a dashed route with its destination in words", () => {
    const { container } = render(
      chart({
        overlay,
        orders: orders({
          pending: [
            {
              commandId: "cmd-1",
              fleetId: "home-fleet",
              fromMapAreaId: "area_north_sea",
              toMapAreaId: "area_western_approaches",
              destinationName: "Western Approaches",
            },
          ],
        }),
      }),
    );
    expect(container.textContent).toContain("Ordered: Western Approaches");
    expect(homeLayer(container, "orders")).not.toBeNull();
  });

  it("highlights legal destinations and dims the rest while a fleet is selected", () => {
    const { container } = render(
      chart({ overlay, orders: orders({ selectedFleetId: "home-fleet" }) }),
    );
    const paths = [...container.querySelectorAll("path[data-map-area]")];
    const legal = paths.filter((path) => path.hasAttribute("data-legal"));
    expect(legal.map((path) => path.getAttribute("data-map-area"))).toEqual([
      "area_western_approaches",
    ]);
    const dimmed = paths.filter((path) => path.getAttribute("class")?.includes("opacity-35"));
    expect(dimmed.length).toBeGreaterThan(0);
  });

  it("states in the legend what the map does not model", () => {
    const { container } = render(chart({ overlay, orders: orders() }));
    expect(container.textContent).toContain(
      "Foreign fleet positions are not known: intelligence is not modelled yet.",
    );
    expect(container.textContent).toContain("Invasion range is not modelled yet.");
  });

  it("marks blockaded areas the player is party to", () => {
    const { container } = render(
      chart({
        overlay,
        orders: orders({ blockadedMapAreas: new Set(["area_western_approaches"]) }),
      }),
    );
    const blockaded = [...container.querySelectorAll("[data-blockade]")].map((element) =>
      element.getAttribute("data-map-area"),
    );
    expect(blockaded).toContain("area_western_approaches");
  });
});
