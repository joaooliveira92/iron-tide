/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { LiveWorldMapOverlay } from "../../components/world-map/campaign-map-join.js";
import type { MapOrderFleet } from "../../components/world-map/map-orders.js";
import { initialMapPrototypeState } from "../../components/world-map/map-state.js";
import { StrategicMapScreen } from "./StrategicMapScreen.js";

const noop = () => undefined;

const overlay: LiveWorldMapOverlay = {
  source: "campaign",
  ownership: new Map([
    ["area_north_sea", "GBR"],
    ["area_western_approaches", "GBR"],
  ]),
  fleets: [
    { id: "home-fleet", name: "Home Fleet", area: "area_north_sea", nation: "GBR", ships: 12 },
  ],
  ports: [],
  lanes: [{ a: "area_north_sea", b: "area_western_approaches" }],
  campaignAreas: [
    { id: "sea_north_sea", name: "North Sea", controller: "GBR", fleets: [] },
    { id: "sea_western_approaches", name: "Western Approaches", controller: "GBR", fleets: [] },
  ],
  playerNationId: "GBR",
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
  it("renders the production map and the fleet orders panel", () => {
    render(<StrategicMapScreen sessionId="ses-1" />);
    expect(screen.getByRole("application", { name: /World map/ })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Fleet orders" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Home Fleet" })).toBeTruthy();
  });

  it("orders a fleet to a legal destination chosen in the panel", () => {
    hookMocks.stateFn.mockReturnValue(state({ selectedFleet: fleet }));
    render(<StrategicMapScreen sessionId="ses-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Western Approaches" }));
    expect(hookMocks.orderTo).toHaveBeenCalledWith("home-fleet", "sea_western_approaches");
  });

  it("lists the blockades the player is party to, with nation and area names", () => {
    hookMocks.stateFn.mockReturnValue(
      state({
        strategic: {
          world: { areas: [], ports: [], fleets: [], routes: [] },
          playerFleets: [],
          blockades: [
            {
              blockaderId: "FRA",
              blockadedNationId: "GBR",
              areaId: "sea_western_approaches",
              establishedMonth: "1880-03",
            },
          ],
        },
      }),
    );
    render(<StrategicMapScreen sessionId="ses-1" />);
    expect(screen.getByText(/blockades .+ in Western Approaches/)).toBeTruthy();
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
