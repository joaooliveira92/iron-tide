import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { MovementCommand } from "@bluewave/campaign-engine";
import type { FleetScreenState } from "./fleet-screen-state.js";
import { initialFleetScreenState } from "./fleet-screen-state.js";
import { FleetScreen } from "./FleetScreen.js";

const screenHook = vi.hoisted(() => ({
  selectedDivisionId: "fleet_home" as string | null,
  pendingRoute: null as MovementCommand | null,
  busy: false,
  setSelectedDivisionId: vi.fn(),
  submit: vi.fn(),
  replace: vi.fn(),
  cancel: vi.fn(),
  state: null as FleetScreenState | null,
}));

vi.mock("./hooks/useFleetScreen.js", () => ({
  useFleetScreen: () => ({
    state: {
      ...screenHook.state,
      pendingRequest: screenHook.busy ? { id: "pending" } : null,
    },
    loadError: null,
    selectedDivisionId: screenHook.selectedDivisionId,
    selectedDivision: { divisionId: "fleet_home", fleetName: "Home Fleet", areaId: "home" },
    pendingRoute: screenHook.pendingRoute,
    destinationAreaId: "channel",
    reachableAreas: [{ id: "channel", name: "English Channel" }],
    request: { outcomeUnknown: false, retry: () => undefined },
    loadScreen: async () => undefined,
    setSelectedDivisionId: screenHook.setSelectedDivisionId,
    setDestinationAreaId: () => undefined,
    submit: screenHook.submit,
    replace: screenHook.replace,
    cancel: screenHook.cancel,
  }),
}));
vi.mock("./components/FleetMap.js", () => ({
  FleetMap: ({ leftPanels, rightPanels }: { leftPanels?: ReactNode; rightPanels?: ReactNode }) => (
    <div>
      {leftPanels}
      {rightPanels}
    </div>
  ),
}));
vi.mock("./organization/FleetOrganizationSection.js", () => ({
  FleetOrganizationSection: () => <div />,
}));
vi.mock("./station/FleetStationSection.js", () => ({ FleetStationSection: () => <div /> }));
vi.mock("./exercise/FleetExerciseSection.js", () => ({ FleetExerciseSection: () => <div /> }));
vi.mock("./training/FleetTrainingSection.js", () => ({ FleetTrainingSection: () => <div /> }));
vi.mock("./components/FleetReportSections.js", () => ({ FleetReportSections: () => <div /> }));

const route: MovementCommand = {
  commandId: "cmd_1",
  divisionId: "fleet_home",
  fromAreaId: "home",
  toAreaId: "channel",
  status: "submitted",
  submittedAtRevision: 4,
};

const loaded: FleetScreenState = {
  ...initialFleetScreenState(),
  playerNationId: "uk",
  divisions: [
    { divisionId: "fleet_home", fleetName: "Home Fleet", areaId: "home", ships: [] },
    { divisionId: "fleet_med", fleetName: "Med Fleet", areaId: "malta", ships: [] },
  ] as FleetScreenState["divisions"],
  areas: [
    { id: "home", name: "English Home Waters" },
    { id: "channel", name: "English Channel" },
  ] as FleetScreenState["areas"],
};

function press(key: string, target: Element | Window = window): void {
  fireEvent.keyDown(target, { key });
}

describe("FleetScreen hotkeys", () => {
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
  beforeEach(() => {
    screenHook.state = loaded;
    screenHook.selectedDivisionId = "fleet_home";
    screenHook.pendingRoute = null;
    screenHook.busy = false;
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("steps the division selection with [ and ]", () => {
    render(<FleetScreen sessionId="ses-1" />);
    press("]");
    press("[");
    const [next, previous] = screenHook.setSelectedDivisionId.mock.calls.map(
      ([update]) => update as (current: string | null) => string | null,
    );
    expect(next?.("fleet_home")).toBe("fleet_med");
    expect(previous?.("fleet_home")).toBe("fleet_med");
  });

  it("submits the order on Enter when none is pending", () => {
    render(<FleetScreen sessionId="ses-1" />);
    press("Enter");
    expect(screenHook.submit).toHaveBeenCalledTimes(1);
    expect(screenHook.replace).not.toHaveBeenCalled();
  });

  it("replaces the pending order on Enter and cancels it on Escape", () => {
    screenHook.pendingRoute = route;
    render(<FleetScreen sessionId="ses-1" />);
    press("Enter");
    press("Escape");
    expect(screenHook.replace).toHaveBeenCalledWith("cmd_1");
    expect(screenHook.cancel).toHaveBeenCalledWith("cmd_1");
    expect(screenHook.submit).not.toHaveBeenCalled();
  });

  it("does nothing on Enter while a request is in flight", () => {
    screenHook.busy = true;
    render(<FleetScreen sessionId="ses-1" />);
    press("Enter");
    expect(screenHook.submit).not.toHaveBeenCalled();
  });

  it("leaves Enter to a focused button", () => {
    render(<FleetScreen sessionId="ses-1" />);
    press("Enter", screen.getByRole("button", { name: "Refresh" }));
    expect(screenHook.submit).not.toHaveBeenCalled();
  });

  it("focuses the destination picker on M", () => {
    render(<FleetScreen sessionId="ses-1" />);
    press("m");
    const trigger = document.querySelector("[data-fleet-destination]");
    expect(trigger).not.toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("states the hotkeys on the screen", () => {
    render(<FleetScreen sessionId="ses-1" />);
    expect(screen.getByTestId("fleet-hotkey-hint").textContent).toMatch(/Enter submit/);
  });
});
