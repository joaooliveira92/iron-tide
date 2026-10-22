import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useResearchScreen } from "./useResearchScreen.js";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
}));

const projection = {
  nationId: "uk",
  researchBudget: 60,
  annualAllocation: 720,
  researchCap: 120,
  unfundedReason: null,
  fieldPriorities: { MACHINERY: 4, GUNNERY: 2 },
  discoveredTechIds: [],
  inProgressTechnologies: [],
  currentProjectTechId: null,
  revision: 3,
  month: { month: 1, year: 1880 },
};

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
});

describe("useResearchScreen command lifecycle", () => {
  it("submits the draft with the loaded revision through the shared workflow", async () => {
    mocks.execute.mockImplementation(async (command: string) => {
      if (command === "inspectResearchScreen")
        return { outcome: "success", value: projection, diagnostics: [] };
      if (command === "setResearchPriorityCommand")
        return {
          outcome: "success",
          value: { commandId: "cmd-1", priorities: {}, appliedOnNextTurn: true },
          diagnostics: [],
        };
      throw new Error(`unexpected command ${command}`);
    });

    const { result } = renderHook(() => useResearchScreen("ses_1"));
    await waitFor(() => expect(result.current.state.kind).toBe("loaded"));

    await act(async () => {
      result.current.submit();
    });

    await waitFor(() =>
      expect(mocks.execute).toHaveBeenCalledWith(
        "setResearchPriorityCommand",
        expect.objectContaining({
          sessionId: "ses_1",
          expectedRevision: 3,
          fieldPriorities: expect.any(Object),
        }),
      ),
    );
    expect(result.current.state.kind).toBe("submitted");
  });
});
