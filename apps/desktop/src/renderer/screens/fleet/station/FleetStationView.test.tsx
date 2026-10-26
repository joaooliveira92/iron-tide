import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import { axeViolations } from "../../../lib/axe.js";
import { FleetStationView, type FleetStationViewProps } from "./FleetStationSection.js";
import { initialFleetStationState, type FleetStationState } from "./fleet-station-model.js";
import { stationRows } from "./fleet-station-state.js";

const areaName = (id: string) => (id === "home" ? "Home Waters" : id);

const ships = [
  {
    shipId: "alex",
    name: "HMS Alexandra",
    designId: "d",
    status: "active",
    readiness: "ACTIVE",
    crewQuality: 80,
    stationAssignment: "FOREIGN_STATION" as const,
    stationCode: "FS" as const,
    colonialServiceFitted: true as const,
    colonialCode: "c" as const,
  },
  {
    shipId: "dread",
    name: "HMS Dreadnought",
    designId: "d",
    status: "active",
    readiness: "ACTIVE",
    crewQuality: 80,
    overBase: true as const,
    overBaseCode: "*" as const,
    crampedCode: "a" as const,
    rangeCode: "S" as const,
  },
  {
    shipId: "rep",
    name: "HMS Repair",
    designId: "d",
    status: "repair",
    readiness: "REPAIR",
    crewQuality: 80,
    repairMonthsRemaining: 2,
    conditions: ["OutOfAction" as const],
  },
];

function make(
  over: Partial<FleetStationState> = {},
  props: Partial<FleetStationViewProps> = {},
): FleetStationViewProps {
  const state: FleetStationState = {
    ...initialFleetStationState(),
    divisions: [{ divisionId: "f", fleetName: "Home", areaId: "home", ships }],
    areas: [{ id: "home", name: "Home Waters" }],
    ...over,
  };
  return {
    state,
    rows: stationRows(state.divisions, areaName),
    areaName,
    selected: [],
    loadError: null,
    busy: false,
    outcomeUnknown: false,
    onToggle: vi.fn(),
    onSend: vi.fn(() => Promise.resolve("accepted" as CommandOutcome)),
    onSendReadiness: vi.fn(() => Promise.resolve("accepted" as CommandOutcome)),
    onRetry: vi.fn(),
    onReload: vi.fn(),
    ...props,
  };
}

describe("FleetStationView (S-5 09)", () => {
  afterEach(cleanup);

  it("shows the p.48 status codes with text labels, and c, a, S flags as text", () => {
    render(<FleetStationView {...make()} />);
    const alex = within(screen.getByTestId("fleet-station-row-alex"));
    expect(alex.getByText("FS", { exact: false })).toBeTruthy();
    expect(alex.getByText("On foreign station")).toBeTruthy();
    expect(alex.getByText("Equipped for colonial service", { exact: false })).toBeTruthy();
    const dread = within(screen.getByTestId("fleet-station-row-dread"));
    expect(dread.getByText(/Needs maintenance/)).toBeTruthy();
    expect(dread.getByText("Cramped accommodation", { exact: false })).toBeTruthy();
    expect(dread.getByText("Short range", { exact: false })).toBeTruthy();
    const rep = within(screen.getByTestId("fleet-station-row-rep"));
    expect(rep.getByText("In repair for 2 more months")).toBeTruthy();
  });

  it("shows a ship's derived conditions as text beside its status", () => {
    render(<FleetStationView {...make()} />);
    const rep = within(screen.getByTestId("fleet-station-row-rep"));
    expect(rep.getByText("Out of action")).toBeTruthy();
    const dread = within(screen.getByTestId("fleet-station-row-dread"));
    expect(dread.queryByText("Out of action")).toBeNull();
  });

  it("selects ships by keyboard-operable checkboxes and sends assign or clear for the selection", async () => {
    const onToggle = vi.fn();
    const onSend = vi.fn(() => Promise.resolve("accepted" as CommandOutcome));
    const { rerender } = render(<FleetStationView {...make({}, { onToggle, onSend })} />);
    const assign = screen.getByRole("button", {
      name: "Assign to foreign station",
    });
    expect((assign as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select HMS Dreadnought" }));
    expect(onToggle).toHaveBeenCalledWith("dread");

    rerender(<FleetStationView {...make({}, { onToggle, onSend, selected: ["dread", "rep"] })} />);
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Assign to foreign station" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear foreign station" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
    expect(onSend).toHaveBeenNthCalledWith(1, "assign");
    expect(onSend).toHaveBeenNthCalledWith(2, "clear");
  });

  it("disables the actions while a request is in flight", () => {
    render(<FleetStationView {...make({}, { selected: ["dread"], busy: true })} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Assign to foreign station",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("surfaces a typed rejection as text", () => {
    render(
      <FleetStationView
        {...make({
          notice:
            "STATION_ASSIGNMENT_REJECTED:\n• Assignment rejected. Nothing was queued.\n• HMS Repair is not on active service; only active-fleet ships can be assigned.",
        })}
      />,
    );
    expect(screen.getByTestId("fleet-station-notice").textContent).toContain(
      "HMS Repair is not on active service",
    );
  });

  it("says 'not configured' for the dormant presence section and still lists over-base ships", () => {
    render(
      <FleetStationView
        {...make({
          presence: { configured: false },
          overBaseShips: [{ shipId: "dread", name: "HMS Dreadnought", areaId: "home" }],
        })}
      />,
    );
    expect(screen.getByTestId("fleet-presence-not-configured").textContent).toMatch(
      /not configured/,
    );
    expect(screen.queryByTestId("fleet-presence-exempt")).toBeNull();
    expect(
      within(screen.getByTestId("fleet-over-base")).getByText("HMS Dreadnought in Home Waters"),
    ).toBeTruthy();
  });

  it("renders required, present, shortfall and the blockade exemption notice from the projection", () => {
    const configured = {
      configured: true as const,
      areas: [
        {
          areaId: "home",
          requiredTons: 400,
          presentTons: 150,
          shortfallTons: 250,
        },
      ],
    };
    const { rerender } = render(
      <FleetStationView {...make({ presence: { ...configured, exempt: false } })} />,
    );
    const presence = within(screen.getByTestId("fleet-presence"));
    expect(presence.getByText("400 t")).toBeTruthy();
    expect(presence.getByText("150 t")).toBeTruthy();
    expect(presence.getByText("250 t")).toBeTruthy();
    expect(screen.queryByTestId("fleet-presence-exempt")).toBeNull();
    expect(
      within(screen.getByTestId("fleet-over-base")).getByText("No ships are beyond a base limit."),
    ).toBeTruthy();

    rerender(
      <FleetStationView
        {...make({
          presence: {
            configured: true,
            exempt: true,
            areas: [
              {
                areaId: "home",
                requiredTons: 400,
                presentTons: 150,
                shortfallTons: 0,
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByTestId("fleet-presence-exempt").textContent).toMatch(/blockaded/);
    expect(screen.getByText("None (suspended)")).toBeTruthy();
  });

  it("offers retry when the outcome is unknown and reload on a load error", () => {
    const onRetry = vi.fn();
    const onReload = vi.fn();
    render(
      <FleetStationView
        {...make({}, { outcomeUnknown: true, loadError: "boom", onRetry, onReload })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onRetry).toHaveBeenCalled();
    expect(onReload).toHaveBeenCalled();
  });

  it("has no structural accessibility violations (configured, exempt, with a rejection)", async () => {
    const { container } = render(
      <FleetStationView
        {...make(
          {
            notice: "Rejected.",
            presence: {
              configured: true,
              exempt: true,
              areas: [
                {
                  areaId: "home",
                  requiredTons: 4,
                  presentTons: 1,
                  shortfallTons: 0,
                },
              ],
            },
            overBaseShips: [{ shipId: "dread", name: "HMS Dreadnought", areaId: "home" }],
          },
          { selected: ["dread"] },
        )}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
