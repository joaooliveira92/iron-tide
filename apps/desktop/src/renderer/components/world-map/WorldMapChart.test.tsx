import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { WorldMapChart } from "./WorldMapChart.js";
import { initialMapPrototypeState } from "./map-state.js";

const noop = () => undefined;

function renderChart() {
  return render(
    <WorldMapChart
      state={initialMapPrototypeState}
      route={null}
      onSelect={noop}
      onRuler={noop}
      onToggleLayer={noop}
      onSetProjection={noop}
      onSetCentre={noop}
    />,
  );
}

describe("WorldMapChart", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("is keyboard-focusable and handles pan/zoom/reset keys without throwing", () => {
    renderChart();
    const map = screen.getByRole("application");
    expect(map.getAttribute("tabindex")).toBe("0");
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "0"]) {
      expect(fireEvent.keyDown(map, { key })).toBe(false);
    }
    expect(fireEvent.keyDown(map, { key: "x" })).toBe(true);
  });

  it("tells the player when canvas drawing is unavailable instead of drawing nothing", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.stubGlobal("Path2D", class {});
    renderChart();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/coastline unavailable/i);
    vi.unstubAllGlobals();
  });

  it("renders a scale bar element and the layer toolbar", () => {
    const { container } = renderChart();
    expect(container.querySelector('[aria-hidden="true"] span')).not.toBeNull();
    expect(screen.getByText("Ownership")).toBeTruthy();
  });

  it("exposes area ownership as text: labelled keyboard-selectable areas and a data table", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <WorldMapChart
        state={initialMapPrototypeState}
        route={null}
        onSelect={onSelect}
        onRuler={noop}
        onToggleLayer={noop}
        onSetProjection={noop}
        onSetCentre={noop}
      />,
    );
    const areas = [...container.querySelectorAll('path[role="button"]')];
    expect(areas.length).toBe(36);
    for (const area of areas) {
      expect(area.getAttribute("aria-label")).toMatch(
        /: (held by .+|unclaimed), (no fleets|\d+ fleets?)(, strength \d+ ships? \(.+\))?(, no campaign data)?$/,
      );
      expect(area.getAttribute("tabindex")).toBe("0");
    }
    const first = areas[0] as Element;
    fireEvent.keyDown(first, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(first, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(2);

    const table = screen.getByRole("table", { name: "Area control" });
    expect(table.querySelectorAll("tbody tr").length).toBe(areas.length);
  });

  describe("panel variant (embedded on Overview)", () => {
    function renderPanel() {
      return render(
        <WorldMapChart
          variant="panel"
          state={initialMapPrototypeState}
          route={null}
          onSelect={noop}
          onRuler={noop}
          onToggleLayer={noop}
          onSetProjection={noop}
          onSetCentre={noop}
        />,
      );
    }
    const hidden = (element: HTMLElement) => element.closest(".hidden") !== null;

    it("collapses the layer controls behind a Layers button until opened", () => {
      renderPanel();
      const layers = screen.getByRole("button", { name: "Layers & areas" });
      expect(layers.getAttribute("aria-expanded")).toBe("false");
      expect(hidden(screen.getByText("Ownership"))).toBe(true);

      fireEvent.click(layers);
      expect(layers.getAttribute("aria-expanded")).toBe("true");
      expect(hidden(screen.getByText("Ownership"))).toBe(false);

      fireEvent.click(layers);
      expect(hidden(screen.getByText("Ownership"))).toBe(true);
    });

    it("keeps idle hint cards out of the way", () => {
      renderPanel();
      expect(hidden(screen.getByText(/Click an area to inspect/))).toBe(true);
      expect(screen.queryByText(/Shift-click two areas for a route reading/)).toBeNull();
    });

    it("can omit the minimap", () => {
      const { container } = render(
        <WorldMapChart
          variant="panel"
          showMinimap={false}
          state={initialMapPrototypeState}
          route={null}
          onSelect={noop}
          onRuler={noop}
          onToggleLayer={noop}
          onSetProjection={noop}
          onSetCentre={noop}
        />,
      );
      expect(container.querySelector('[data-testid="map-minimap"]')).toBeNull();
    });
  });

  describe("command variant (full-bleed campaign home)", () => {
    function renderCommand(treeDefaultOpen = true) {
      return render(
        <WorldMapChart
          variant="command"
          treeDefaultOpen={treeDefaultOpen}
          leftPanels={<p>Left panel</p>}
          rightPanels={<p>Right panel</p>}
          state={initialMapPrototypeState}
          route={null}
          onSelect={noop}
          onRuler={noop}
          onToggleLayer={noop}
          onSetProjection={noop}
          onSetCentre={noop}
        />,
      );
    }

    it("is frameless and puts the area tree in the left dock as its own collapsible panel", () => {
      const { container } = renderCommand();
      expect((container.firstElementChild as HTMLElement).className).not.toMatch(/border|rounded/);
      const dock = screen.getByTestId("map-left-dock");
      expect(within(dock).getByTestId("area-list")).toBeTruthy();
      expect(within(dock).getByText("Left panel")).toBeTruthy();
      expect(within(screen.getByTestId("map-right-dock")).getByText("Right panel")).toBeTruthy();
      expect(screen.getByTestId("area-list").closest(".hidden")).toBeNull();
    });

    it("lets pointer events through the docks so the map can still pan and zoom", () => {
      renderCommand();
      expect(screen.getByTestId("map-left-dock").className).toMatch(/pointer-events-none/);
      expect(screen.getByTestId("map-right-dock").className).toMatch(/pointer-events-none/);
      expect(screen.getByTestId("area-list").className).toMatch(/pointer-events-auto/);
    });

    it("starts the area tree collapsed when asked (compact density)", () => {
      sessionStorage.clear();
      renderCommand(false);
      expect(screen.getByRole("button", { name: /^Areas/ }).getAttribute("aria-expanded")).toBe(
        "false",
      );
    });
  });

  it("the full variant shows every control from the start", () => {
    renderChart();
    expect(screen.queryByRole("button", { name: "Layers & areas" })).toBeNull();
    expect(screen.getByText("Ownership").closest(".hidden")).toBeNull();
  });

  describe("area tree", () => {
    const liveOverlay = {
      source: "campaign" as const,
      ownership: new Map(),
      fleets: [],
      ports: [],
      lanes: [],
      playerNationId: "uk",
      campaignAreas: [
        {
          id: "sea_north_sea",
          name: "North Sea",
          controller: null,
          fleets: [{ nation: "uk", ships: 4 }],
        },
        { id: "med_malta", name: "Malta", controller: "uk", fleets: [] },
      ],
    };

    function renderLive() {
      const onSelect = vi.fn();
      render(
        <WorldMapChart
          state={initialMapPrototypeState}
          route={null}
          overlay={liveOverlay}
          onSelect={onSelect}
          onRuler={noop}
          onToggleLayer={noop}
          onSetProjection={noop}
          onSetCentre={noop}
        />,
      );
      return onSelect;
    }

    it("falls back to the fixture areas, one group, when there is no campaign", () => {
      render(
        <WorldMapChart
          state={initialMapPrototypeState}
          route={null}
          onSelect={noop}
          onRuler={noop}
          onToggleLayer={noop}
          onSetProjection={noop}
          onSetCentre={noop}
        />,
      );
      expect(screen.getByRole("list", { name: "Areas by region" })).toBeTruthy();
    });

    it("groups the player's ships under expandable regions with a count badge", () => {
      renderLive();
      const region = screen.getByRole("button", { name: /Northern Europe/ });
      expect(region.getAttribute("aria-expanded")).toBe("false");
      expect(within(region).getByLabelText("4 ships")).toBeTruthy();
      fireEvent.click(region);
      expect(region.getAttribute("aria-expanded")).toBe("true");
      expect(
        within(screen.getByTestId("area-tree")).getByRole("button", { name: /North Sea/ })
          .textContent,
      ).toContain("4 ships");
    });

    it("switches to Possessions and lists the player's areas", () => {
      renderLive();
      const group = screen.getByRole("group", { name: "Show in the area tree" });
      fireEvent.click(within(group).getByRole("button", { name: "Possessions" }));
      expect(screen.queryByRole("button", { name: /Northern Europe/ })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /The Mediterranean/ }));
      expect(
        within(screen.getByTestId("area-tree")).getByRole("button", { name: /Malta/ }).textContent,
      ).toContain("Britain");
    });

    it("filters by name and says when nothing matches", () => {
      renderLive();
      fireEvent.change(screen.getByLabelText("Filter areas"), { target: { value: "zzzzzz" } });
      expect(screen.getByText("No areas with your ships.")).toBeTruthy();
    });

    it("selects the row's map area when clicked", () => {
      const onSelect = renderLive();
      fireEvent.click(screen.getByRole("button", { name: /Northern Europe/ }));
      fireEvent.click(
        within(screen.getByTestId("area-tree")).getByRole("button", { name: /North Sea/ }),
      );
      expect(onSelect).toHaveBeenCalledWith("area_north_sea");
    });
  });
});
