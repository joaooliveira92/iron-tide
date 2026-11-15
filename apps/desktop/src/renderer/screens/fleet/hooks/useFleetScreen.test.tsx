import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useFleetInspectionCache } from "./useFleetInspection.js";
import { useFleetScreen } from "./useFleetScreen.js";

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

const baseProjection = {
  revision: 1,
  month: { month: 1, year: 1880 },
  playerNationId: "uk",
  divisions: [{ divisionId: "f", fleetName: "Home", areaId: "home", ships: [] }],
  areas: [
    { id: "home", name: "Home Waters" },
    { id: "far", name: "Far Waters" },
  ],
  areaEdges: [{ fromAreaId: "home", toAreaId: "far" }],
  ports: [],
  movementCommands: [],
  presence: { configured: false },
  overBaseShips: [],
};

const warning = {
  areaId: "home",
  requiredTons: 1200,
  presentTonsBefore: 8540,
  presentTonsAfter: 0,
  shortfallBefore: 0,
  shortfallAfter: 1200,
  causeCommandIds: ["cmd-1"],
  explanation: { kind: "leaf", id: "x", label: "x", value: 0 },
};

function respond(command: string, queued: { current: boolean }) {
  if (command === "inspectFleetScreen") {
    return Promise.resolve({
      outcome: "success",
      value: queued.current ? { ...baseProjection, presenceWarnings: [warning] } : baseProjection,
      diagnostics: [],
    });
  }
  queued.current = true;
  return Promise.resolve({
    outcome: "success",
    value: {
      workspace: { movementCommands: [] },
      command: { commandId: "cmd-1", status: "queued" },
    },
    diagnostics: [],
  });
}

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
});

describe("useFleetScreen presence warnings", () => {
  it("reloads the inspection after an accepted order so the warning it causes appears at once", async () => {
    const queued = { current: false };
    mocks.execute.mockImplementation((command: string) => respond(command, queued));
    const { result } = renderHook(() => {
      const load = useFleetInspectionCache("s");
      return useFleetScreen("s", load);
    });
    await waitFor(() => expect(result.current.selectedDivisionId).toBe("f"));
    expect(result.current.state.presenceWarnings).toEqual([]);

    await act(async () => {
      result.current.submit();
    });

    await waitFor(() => expect(result.current.state.presenceWarnings).toHaveLength(1));
    expect(result.current.state.presenceWarnings[0]?.areaId).toBe("home");
  });
});
