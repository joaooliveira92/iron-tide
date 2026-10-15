import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import type { FleetScreenState } from "./fleet-screen-state.js";
import { initialFleetScreenState } from "./fleet-screen-state.js";
import { FleetScreen } from "./FleetScreen.js";

const hook = vi.hoisted(() => ({ state: null as unknown }));
vi.mock("./hooks/useFleetScreen.js", () => ({
  useFleetScreen: () => ({
    state: hook.state,
    loadError: null,
    selectedDivisionId: "fleet_home",
    selectedDivision: null,
    pendingRoute: null,
    destinationAreaId: null,
    reachableAreas: [{ id: "channel", name: "English Channel" }],
    request: { outcomeUnknown: false, retry: () => undefined },
    loadScreen: async () => undefined,
    setSelectedDivisionId: () => undefined,
    setDestinationAreaId: () => undefined,
    submit: () => undefined,
    replace: () => undefined,
    cancel: () => undefined,
  }),
}));
// The heavy children have their own tests; here only the screen's composition is under test.
vi.mock("../../components/world-map/WorldMapPanel.js", () => ({
  WorldMapPanel: () => <div data-testid="map-stub" />,
}));
vi.mock("./organization/FleetOrganizationSection.js", () => ({
  FleetOrganizationSection: () => <div data-testid="organization-stub" />,
}));

vi.mock("./components/FleetReportSections.js", () => ({
  FleetReportSections: () => <div data-testid="report-sections-stub" />,
}));

const loaded: FleetScreenState = {
  ...initialFleetScreenState(),
  playerNationId: "uk",
  divisions: [
    { divisionId: "fleet_home", fleetName: "Home Fleet", areaId: "home", ships: [] },
  ] as FleetScreenState["divisions"],
  areas: [{ id: "home", name: "English Home Waters" }] as FleetScreenState["areas"],
};

describe("FleetScreen", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(cleanup);

  it("offers movement orders limited to the areas one hop away, and no longer claims they are unmodelled", () => {
    hook.state = loaded;
    render(<FleetScreen sessionId="ses-1" />);
    expect(screen.getByRole("button", { name: /Submit movement command/ })).toBeTruthy();
    expect(screen.getByText("Movement commands")).toBeTruthy();
    expect(screen.queryByTestId("movement-deferred")).toBeNull();
  });

  it("composes the positions map, organization, report sections and area overview", () => {
    hook.state = loaded;
    render(<FleetScreen sessionId="ses-1" />);
    expect(screen.getByRole("heading", { name: "Fleet", level: 2 })).toBeTruthy();
    expect(screen.getByTestId("map-stub")).toBeTruthy();
    expect(screen.getByTestId("organization-stub")).toBeTruthy();
    expect(screen.getByTestId("report-sections-stub")).toBeTruthy();
    expect(screen.getByText("Area overview")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Home Fleet/ })).toBeTruthy();
  });
});
