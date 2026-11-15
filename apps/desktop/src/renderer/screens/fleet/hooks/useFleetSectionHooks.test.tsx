import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useFleetExercise } from "../exercise/useFleetExercise.js";
import { useStationAssignment } from "../station/useStationAssignment.js";
import { useSpecialTraining } from "../training/useSpecialTraining.js";
import { useDivisionOrganization } from "./useDivisionOrganization.js";
import { FleetInspectionContext, useFleetInspectionCache } from "./useFleetInspection.js";

const mocks = vi.hoisted(() => {
  const execute = vi.fn();
  return { execute, bridge: { campaign: { execute } } };
});
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => mocks.bridge,
}));
vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => 1,
}));

const projection = {
  revision: 1,
  month: { month: 1, year: 1880 },
  playerNationId: "uk",
  divisions: [
    {
      divisionId: "f",
      fleetName: "Home",
      areaId: "home",
      ships: [
        {
          shipId: "a",
          name: "HMS A",
          designId: "d",
          status: "active",
          readiness: "ACTIVE",
          crewQuality: 1,
        },
      ],
    },
  ],
  areas: [{ id: "home", name: "Home Waters" }],
  areaEdges: [],
  ports: [],
  movementCommands: [],
  presence: { configured: false },
  overBaseShips: [],
};

function respond(command: string) {
  return command === "inspectFleetScreen"
    ? Promise.resolve({ outcome: "success", value: projection, diagnostics: [] })
    : new Promise(() => undefined);
}

function AllSections() {
  useStationAssignment("s");
  useFleetExercise("s");
  useSpecialTraining("s");
  return null;
}

function Screen() {
  const load = useFleetInspectionCache("s");
  return (
    <FleetInspectionContext value={load}>
      <AllSections />
    </FleetInspectionContext>
  );
}

describe("fleet section hooks", () => {
  afterEach(() => {
    cleanup();
    mocks.execute.mockReset();
  });

  it("reads inspectFleetScreen once per mount for station, exercise and training together", async () => {
    mocks.execute.mockImplementation(respond);
    render(<Screen />);
    await waitFor(() => expect(mocks.execute).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    const reads = mocks.execute.mock.calls.filter(([command]) => command === "inspectFleetScreen");
    expect(reads).toHaveLength(1);
  });

  it("keeps handler identities stable across re-renders", async () => {
    mocks.execute.mockImplementation(respond);
    const { result, rerender } = renderHook(() => ({
      station: useStationAssignment("s"),
      exercise: useFleetExercise("s"),
      training: useSpecialTraining("s"),
      division: useDivisionOrganization("s"),
    }));
    await waitFor(() => expect(result.current.station.rows).toHaveLength(1));
    await act(async () => {
      await Promise.resolve();
    });
    rerender();
    const before = result.current;
    rerender();
    const after = result.current;
    expect(after.station.toggle).toBe(before.station.toggle);
    expect(after.station.loadScreen).toBe(before.station.loadScreen);
    expect(after.station.send).toBe(before.station.send);
    expect(after.station.sendReadiness).toBe(before.station.sendReadiness);
    expect(after.station.areaName).toBe(before.station.areaName);
    expect(after.exercise.toggle).toBe(before.exercise.toggle);
    expect(after.exercise.reload).toBe(before.exercise.reload);
    expect(after.exercise.hold).toBe(before.exercise.hold);
    expect(after.training.reload).toBe(before.training.reload);
    expect(after.training.fund).toBe(before.training.fund);
    expect(after.division.send).toBe(before.division.send);
    expect(after.division.loadScreen).toBe(before.division.loadScreen);
  });

  it("keeps toggle stable when the selection changes", async () => {
    mocks.execute.mockImplementation(respond);
    const { result } = renderHook(() => useStationAssignment("s"));
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    const toggle = result.current.toggle;
    act(() => result.current.toggle("a"));
    expect(result.current.selected).toEqual(["a"]);
    expect(result.current.toggle).toBe(toggle);
  });
});
