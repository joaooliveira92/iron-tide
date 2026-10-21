import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useStationAssignment } from "./useStationAssignment.js";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
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
        {
          shipId: "b",
          name: "HMS B",
          designId: "d",
          status: "repair",
          readiness: "REPAIR",
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

describe("useStationAssignment", () => {
  afterEach(() => {
    cleanup();
    mocks.execute.mockReset();
  });

  it("words the engine's per-ship rejection reasons as text and keeps the selection", async () => {
    mocks.execute.mockImplementation((command: string) =>
      command === "inspectFleetScreen"
        ? Promise.resolve({
            outcome: "success",
            value: projection,
            diagnostics: [],
          })
        : Promise.resolve({
            outcome: "rejected",
            reason: "STATION_ASSIGNMENT_REJECTED",
            diagnostics: ["Foreign-station assign rejected: b=NOT_ACTIVE"],
          }),
    );
    const { result } = renderHook(() => useStationAssignment("s"));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.toggle("b"));
    let outcome = "";
    await act(async () => {
      outcome = await result.current.send("assign");
    });
    expect(outcome).toBe("rejected");
    expect(result.current.selected).toEqual(["b"]);
    expect(result.current.state.notice).toContain("HMS B is not on active service");
    expect(mocks.execute).toHaveBeenCalledWith(
      "submitStationAssignment",
      expect.objectContaining({ intent: "assign", shipIds: ["b"] }),
    );
  });

  it("clears the selection and reports the queued count when accepted", async () => {
    mocks.execute.mockImplementation((command: string) =>
      command === "inspectFleetScreen"
        ? Promise.resolve({
            outcome: "success",
            value: projection,
            diagnostics: [],
          })
        : Promise.resolve({
            outcome: "success",
            value: {
              commandId: "c",
              intent: "assign",
              shipCount: 1,
              appliedOnNextTurn: true,
            },
            diagnostics: [],
          }),
    );
    const { result } = renderHook(() => useStationAssignment("s"));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    act(() => result.current.toggle("a"));
    await act(async () => {
      await result.current.send("assign");
    });
    expect(result.current.selected).toEqual([]);
    expect(result.current.state.notice).toContain("queued for 1 ship(s)");
  });
});
