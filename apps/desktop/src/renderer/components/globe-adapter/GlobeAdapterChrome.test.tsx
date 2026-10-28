import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { GlobeAdapterChrome } from "./GlobeAdapterChrome.js";
import { deriveAdapterModel } from "./adapter-derivations.js";
import { EMPTY_LIVE_OVERLAY } from "../world-map/campaign-map-join.js";
import { initialMapPrototypeState } from "../world-map/map-state.js";
import type { RouteReading } from "../world-map/map-state.js";

const noop = () => undefined;

function overlay() {
  return {
    ...EMPTY_LIVE_OVERLAY,
    source: "campaign" as const,
    ownership: new Map([["area_north_sea", "united_kingdom"]]),
    fleets: [
      {
        id: "fleet-home",
        name: "Home Fleet",
        area: "area_north_sea",
        nation: "united_kingdom",
        ships: 12,
      },
    ],
    lanes: [{ a: "area_north_sea", b: "area_western_approaches" }],
  };
}

const route: RouteReading = {
  path: ["area_north_sea", "area_western_approaches"],
  hops: 1,
  nauticalMiles: 420,
  perHop: 420,
  months: 0.1,
};

function renderChrome(overrides: Partial<React.ComponentProps<typeof GlobeAdapterChrome>> = {}) {
  const model = deriveAdapterModel(overlay(), "area_north_sea");
  const props: React.ComponentProps<typeof GlobeAdapterChrome> = {
    state: initialMapPrototypeState,
    route: null,
    viewport: { centre: [0, 30], zoom: 2, bearing: 0, pitch: 0 },
    variant: "full",
    treeRows: model.treeRows,
    ownershipRows: model.ownershipRows,
    summary: model.summary,
    nameFor: model.nameFor,
    onSelect: noop,
    onToggleLayer: noop,
    onSetProjection: noop,
    onSetCentre: noop,
    onReset: noop,
    onRecentre: noop,
    ...overrides,
  };
  return render(<GlobeAdapterChrome {...props} />);
}

describe("GlobeAdapterChrome", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("exposes every area as a focusable button with its pressed state", () => {
    const onSelect = vi.fn();
    renderChrome({ onSelect });
    const list = screen.getByRole("navigation", { name: "Map areas" });
    const northSea = within(list).getByRole("button", { name: /North Sea/ });
    expect(northSea.getAttribute("aria-pressed")).toBe("true");
    expect(northSea.className).toContain("focus-visible:outline");
    fireEvent.click(northSea);
    expect(onSelect).toHaveBeenCalledWith("area_north_sea");
    expect(within(list).getAllByRole("button").length).toBeGreaterThan(30);
    expect(screen.getByTestId("globe-adapter-frame-meter")).toBeTruthy();
  });

  it("wires layer, projection, reset and centre controls to application state", () => {
    const onToggleLayer = vi.fn();
    const onSetProjection = vi.fn();
    const onReset = vi.fn();
    const onSetCentre = vi.fn();
    renderChrome({ onToggleLayer, onSetProjection, onReset, onSetCentre });
    fireEvent.click(screen.getByRole("button", { name: "Ownership" }));
    expect(onToggleLayer).toHaveBeenCalledWith("ownership");
    fireEvent.click(screen.getByRole("button", { name: "Miller cylindrical" }));
    expect(onSetProjection).toHaveBeenCalledWith("miller");
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(onReset).toHaveBeenCalled();
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "40" } });
    expect(onSetCentre).toHaveBeenCalledWith(40);
  });

  it("shows the route reading numbers and the shift-click prompt", () => {
    const { rerender } = renderChrome();
    expect(screen.getByText(/Shift-click two areas/)).toBeTruthy();
    rerender(
      <GlobeAdapterChrome
        state={initialMapPrototypeState}
        route={route}
        viewport={{ centre: [0, 30], zoom: 2, bearing: 0, pitch: 0 }}
        variant="full"
        treeRows={[]}
        ownershipRows={[]}
        summary={null}
        nameFor={() => "Unclaimed"}
        onSelect={noop}
        onToggleLayer={noop}
        onSetProjection={noop}
        onSetCentre={noop}
        onReset={noop}
        onRecentre={noop}
      />,
    );
    expect(screen.getAllByText(/420 nm/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/nm\/hop/).length).toBeGreaterThan(0);
    expect(screen.getByText(/0\.1 months/)).toBeTruthy();
  });

  it("renders a minimap and legend and recentres from a minimap click", () => {
    const onRecentre = vi.fn();
    renderChrome({ onRecentre });
    const minimap = screen.getByTestId("globe-adapter-minimap");
    vi.spyOn(minimap, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 176,
      height: 88,
      right: 176,
      bottom: 88,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(minimap, { clientX: 88, clientY: 44, pointerId: 1 });
    expect(onRecentre).toHaveBeenCalled();
    expect(screen.getAllByText("Ports").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fleets").length).toBeGreaterThan(0);
  });

  it("remembers the layers and areas disclosure for the session", () => {
    sessionStorage.clear();
    const { unmount } = renderChrome();
    expect(screen.getByRole("button", { name: "Ownership" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Layers & areas" }));
    expect(screen.queryByRole("button", { name: "Ownership" })).toBeNull();
    unmount();
    renderChrome();
    expect(screen.queryByRole("button", { name: "Ownership" })).toBeNull();
    sessionStorage.clear();
  });

  it("renders the screen-reader area control table with the selected row", () => {
    renderChrome();
    const table = screen.getByTestId("globe-adapter-area-table");
    const selected = table.querySelector("tr[aria-selected='true']");
    expect(selected?.textContent).toContain("North Sea");
    expect(selected?.textContent).toContain("united_kingdom");
    expect(selected?.textContent).toContain("12 ships");
  });
});
