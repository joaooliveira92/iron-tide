import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
vi.mock("./components/FleetMap.js", () => ({
  FleetMap: ({ leftPanels, rightPanels }: { leftPanels?: ReactNode; rightPanels?: ReactNode }) => (
    <div data-testid="map-stub">
      {leftPanels}
      {rightPanels}
    </div>
  ),
}));
vi.mock("./organization/FleetOrganizationSection.js", () => ({
  FleetOrganizationSection: () => <div data-testid="organization-stub" />,
}));

vi.mock("./station/FleetStationSection.js", () => ({
  FleetStationSection: () => <div data-testid="station-stub" />,
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
    expect(screen.getByRole("button", { name: /^Orders/ })).toBeTruthy();
    expect(screen.queryByTestId("movement-deferred")).toBeNull();
  });

  it("composes the map, the roster, the dispatch strip and the department tabs", () => {
    hook.state = loaded;
    render(<FleetScreen sessionId="ses-1" />);
    expect(screen.getByRole("heading", { name: "Fleet", level: 2 })).toBeTruthy();
    expect(screen.getByTestId("map-stub")).toBeTruthy();
    expect(screen.getByTestId("fleet-station-board")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Home Fleet/ })).toBeTruthy();
    const affairs = within(screen.getByRole("navigation", { name: "Fleet departments" }));
    for (const name of [
      "Organization",
      "Station",
      "Training",
      "Exercises",
      "Orders",
      "Areas",
      "Reports",
    ]) {
      expect(affairs.getByRole("button", { name: new RegExp(`^${name}`) })).toBeTruthy();
    }
    expect(screen.getByTestId("fleet-order")).toBeTruthy();
    expect(screen.queryByTestId("organization-stub")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows each department's live state on its tab", () => {
    hook.state = loaded;
    render(<FleetScreen sessionId="ses-1" />);
    const affairs = within(screen.getByRole("navigation", { name: "Fleet departments" }));
    expect(affairs.getByRole("button", { name: /^Organization\s*1 division$/ })).toBeTruthy();
    expect(affairs.getByRole("button", { name: /^Orders\s*None sealed$/ })).toBeTruthy();
  });

  it("opens a department drawer beside the chart and lets the player switch departments", async () => {
    hook.state = loaded;
    render(<FleetScreen sessionId="ses-1" />);
    const affairs = within(screen.getByRole("navigation", { name: "Fleet departments" }));
    fireEvent.click(affairs.getByRole("button", { name: /^Organization/ }));
    const drawer = await screen.findByRole("dialog", { name: "Organization" });
    expect(within(drawer).getByTestId("organization-stub")).toBeTruthy();
    expect(screen.queryByTestId("fleet-order")).toBeNull();
    fireEvent.click(affairs.getByRole("button", { name: /^Reports/ }));
    expect(await screen.findByTestId("report-sections-stub")).toBeTruthy();
    fireEvent.click(affairs.getByRole("button", { name: /^Areas/ }));
    expect(await screen.findByRole("columnheader", { name: "Area" })).toBeTruthy();
  });

  it("closes the drawer with its close button and with Escape, restoring the dispatch strip", async () => {
    hook.state = loaded;
    render(<FleetScreen sessionId="ses-1" />);
    const affairs = within(screen.getByRole("navigation", { name: "Fleet departments" }));
    fireEvent.click(affairs.getByRole("button", { name: /^Station/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Close Station" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("fleet-order")).toBeTruthy();
    fireEvent.click(affairs.getByRole("button", { name: /^Station/ }));
    const drawer = await screen.findByRole("dialog", { name: "Station" });
    fireEvent.keyDown(drawer, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
