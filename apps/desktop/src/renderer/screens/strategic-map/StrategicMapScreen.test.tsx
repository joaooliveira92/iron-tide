/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { LiveWorldMapOverlay } from "../../components/world-map/campaign-map-join.js";
import type { MapOrderFleet } from "../../components/world-map/map-orders.js";
import { initialMapPrototypeState } from "../../components/world-map/map-state.js";
import { HOME_FOCUS_SCALE } from "../../components/world-map/useInitialFocusArea.js";
import { StrategicMapScreen } from "./StrategicMapScreen.js";

const noop = () => undefined;

const overlay: LiveWorldMapOverlay = {
  source: "campaign",
  ownership: new Map([
    ["area_north_sea", "uk"],
    ["area_western_approaches", "uk"],
  ]),
  fleets: [
    { id: "home-fleet", name: "Home Fleet", area: "area_north_sea", nation: "uk", ships: 12 },
  ],
  ports: [],
  lanes: [{ a: "area_north_sea", b: "area_western_approaches" }],
  campaignAreas: [
    { id: "sea_north_sea", name: "North Sea", controller: "uk", fleets: [] },
    { id: "sea_western_approaches", name: "Western Approaches", controller: "uk", fleets: [] },
  ],
  playerNationId: "uk",
};

const fleet: MapOrderFleet = {
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
};

const hookMocks = vi.hoisted(() => ({
  stateFn: vi.fn(),
  selectFleet: vi.fn(),
  orderTo: vi.fn(),
  chooseDestination: vi.fn(),
  cancelChoice: vi.fn(),
  cancelOrder: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("./useStrategicMapScreen.js", () => ({
  useStrategicMapScreen: (_sessionId: string) => hookMocks.stateFn(),
}));

function state(overrides: Record<string, unknown> = {}) {
  return {
    map: {
      state: initialMapPrototypeState,
      route: null,
      overlay,
      strategic: null,
      status: "ready" as const,
      reason: null,
      onSelect: noop,
      onRuler: noop,
      onToggleLayer: noop,
      onSetProjection: noop,
      onSetCentre: noop,
    },
    strategic: {
      world: { areas: [], ports: [], fleets: [], routes: [] },
      playerFleets: [],
      blockades: [],
    },
    presence: { configured: false },
    orders: {
      fleets: [fleet],
      pending: [],
      blockadedMapAreas: new Set<string>(),
      selectedFleetId: null,
      onSelectFleet: hookMocks.selectFleet,
      onDrop: noop,
    },
    selectedFleet: null,
    choices: [],
    notice: null,
    noticeKind: "status" as const,
    loadError: null,
    loading: false,
    selectFleet: hookMocks.selectFleet,
    orderTo: hookMocks.orderTo,
    chooseDestination: hookMocks.chooseDestination,
    cancelChoice: hookMocks.cancelChoice,
    cancelOrder: hookMocks.cancelOrder,
    retry: hookMocks.retry,
    ...overrides,
  };
}

beforeEach(() => {
  hookMocks.stateFn.mockReturnValue(state());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StrategicMapScreen", () => {
  it("renders the production map and the fleet dispatch strip", () => {
    render(<StrategicMapScreen sessionId="ses-1" />);
    expect(screen.getByRole("application", { name: /World map/ })).toBeTruthy();
    const strip = within(screen.getByRole("region", { name: "Fleet orders" }));
    expect(strip.getByRole("button", { name: /Home Fleet/ })).toBeTruthy();
    expect(strip.getByText("Pick a fleet to plot a course.")).toBeTruthy();
  });

  it("opens framed on the player's home waters", () => {
    const { container } = render(<StrategicMapScreen sessionId="ses-1" />);
    const world = container.querySelector("svg[role='application'] g");
    expect(world?.getAttribute("transform")).toContain(`scale(${HOME_FOCUS_SCALE})`);
  });

  it("orders a fleet to a legal destination chosen in the panel", () => {
    hookMocks.stateFn.mockReturnValue(state({ selectedFleet: fleet }));
    render(<StrategicMapScreen sessionId="ses-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Western Approaches" }));
    expect(hookMocks.orderTo).toHaveBeenCalledWith("home-fleet", "sea_western_approaches");
  });

  it("shows each department as a tab that reports its live state", () => {
    render(<StrategicMapScreen sessionId="ses-1" />);
    const tabs = within(screen.getByRole("navigation", { name: "Strategic affairs" }));
    expect(tabs.getByRole("button", { name: /^Orders\s*None sealed$/ })).toBeTruthy();
    expect(tabs.getByRole("button", { name: /^Blockades\s*None$/ })).toBeTruthy();
    expect(tabs.getByRole("button", { name: /^Foreign stations\s*Not configured$/ })).toBeTruthy();
    expect(tabs.getByRole("button", { name: /^Areas\s*2 areas$/ })).toBeTruthy();
    expect(tabs.getByRole("button", { name: /^Intelligence\s*Not modelled$/ })).toBeTruthy();
  });

  it("opens the foreign stations ledger with the areas that are short of tonnage", () => {
    hookMocks.stateFn.mockReturnValue(
      state({
        presence: {
          configured: true,
          areas: [
            { areaId: "sea_north_sea", requiredTons: 900, presentTons: 150, shortfallTons: 750 },
          ],
        },
      }),
    );
    render(<StrategicMapScreen sessionId="ses-1" />);
    const tabs = within(screen.getByRole("navigation", { name: "Strategic affairs" }));
    expect(tabs.getByRole("button", { name: /^Foreign stations\s*1 short$/ })).toBeTruthy();
    fireEvent.click(tabs.getByRole("button", { name: /^Foreign stations/ }));
    const drawer = within(screen.getByRole("dialog", { name: "Foreign stations" }));
    expect(drawer.getByText("750 t short")).toBeTruthy();
    expect(drawer.getByText("Required 900 t, present 150 t")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Fleet orders" })).toBeNull();
    fireEvent.click(drawer.getByRole("button", { name: "Close Foreign stations" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("region", { name: "Fleet orders" })).toBeTruthy();
  });

  it("seals the selected fleet's order and lets the player cancel it", () => {
    hookMocks.stateFn.mockReturnValue(
      state({
        selectedFleet: fleet,
        orders: {
          fleets: [fleet],
          pending: [
            {
              commandId: "cmd-1",
              fleetId: "home-fleet",
              fromMapAreaId: "area_north_sea",
              toMapAreaId: "area_western_approaches",
              destinationName: "Western Approaches",
            },
          ],
          blockadedMapAreas: new Set<string>(),
          selectedFleetId: "home-fleet",
          onSelectFleet: hookMocks.selectFleet,
          onDrop: noop,
        },
      }),
    );
    render(<StrategicMapScreen sessionId="ses-1" />);
    const strip = within(screen.getByRole("region", { name: "Fleet orders" }));
    expect(strip.getByText("Ordered: sails for Western Approaches at month end")).toBeTruthy();
    fireEvent.click(strip.getByRole("button", { name: "Cancel order" }));
    expect(hookMocks.cancelOrder).toHaveBeenCalledWith("cmd-1");
    const tabs = within(screen.getByRole("navigation", { name: "Strategic affairs" }));
    expect(tabs.getByRole("button", { name: /^Orders\s*1 sealed$/ })).toBeTruthy();
  });

  it("shows the read failure with a retry instead of a world", () => {
    hookMocks.stateFn.mockReturnValue(state({ loadError: "TRANSPORT_FAILURE: broken" }));
    render(<StrategicMapScreen sessionId="ses-1" />);
    expect(screen.getByRole("alert").textContent).toContain("TRANSPORT_FAILURE: broken");
    expect(screen.queryByRole("application")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(hookMocks.retry).toHaveBeenCalled();
  });

  it("shows a loading state while the campaign reads settle", () => {
    hookMocks.stateFn.mockReturnValue(state({ loading: true }));
    render(<StrategicMapScreen sessionId="ses-1" />);
    expect(screen.queryByTestId("strategic-map-workspace")).toBeNull();
    expect(screen.queryByRole("application")).toBeNull();
  });
});
