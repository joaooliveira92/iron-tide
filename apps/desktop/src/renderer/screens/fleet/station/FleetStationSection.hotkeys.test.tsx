import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { FleetStationSection } from "./FleetStationSection.js";
import { initialFleetStationState } from "./fleet-station-model.js";

const station = vi.hoisted(() => ({
  selected: [] as string[],
  busy: false,
  sendReadiness: vi.fn(async () => ({ kind: "accepted" })),
}));

vi.mock("./useStationAssignment.js", () => ({
  useStationAssignment: () => ({
    state: initialFleetStationState(),
    rows: [],
    areaName: (id: string) => id,
    selected: station.selected,
    loadError: null,
    busy: station.busy,
    request: { outcomeUnknown: false, retry: () => undefined },
    loadScreen: async () => undefined,
    toggle: () => undefined,
    send: async () => ({ kind: "accepted" }),
    sendReadiness: station.sendReadiness,
  }),
}));

describe("FleetStationSection hotkeys", () => {
  beforeEach(() => {
    station.selected = [];
    station.busy = false;
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it("places the selected ships in reserve on R", () => {
    station.selected = ["dread"];
    render(<FleetStationSection sessionId="ses-1" />);
    fireEvent.keyDown(window, { key: "r" });
    expect(station.sendReadiness).toHaveBeenCalledWith("RESERVE");
  });

  it("does nothing on R with no ships selected", () => {
    render(<FleetStationSection sessionId="ses-1" />);
    fireEvent.keyDown(window, { key: "r" });
    expect(station.sendReadiness).not.toHaveBeenCalled();
  });

  it("does nothing on R while a request is in flight", () => {
    station.selected = ["dread"];
    station.busy = true;
    render(<FleetStationSection sessionId="ses-1" />);
    fireEvent.keyDown(window, { key: "r" });
    expect(station.sendReadiness).not.toHaveBeenCalled();
  });
});
