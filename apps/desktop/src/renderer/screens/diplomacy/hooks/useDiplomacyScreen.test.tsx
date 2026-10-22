import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useDiplomacyScreen } from "./useDiplomacyScreen.js";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
}));

const projection = {
  playerNationId: "uk",
  knownNations: [{ nationId: "france", name: "France" }],
  relations: [
    {
      nationAId: "uk",
      nationBId: "france",
      relation: "neutral",
      tension: 5,
      nap: false,
      since: "1880-01",
      partnerNationId: "france",
      partnerName: "France",
    },
  ],
  wars: [],
  blockades: [],
  areas: [{ areaId: "med_gibraltar", name: "Gibraltar" }],
  revision: 1,
  month: { month: 2, year: 1880 },
};

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
});

describe("useDiplomacyScreen command lifecycle", () => {
  it("submits the drafted command with the loaded revision through the shared workflow", async () => {
    mocks.execute.mockImplementation(async (command: string) => {
      if (command === "inspectDiplomacyScreen")
        return { outcome: "success", value: projection, diagnostics: [] };
      if (command === "submitDiplomacyCommand")
        return {
          outcome: "success",
          value: { commandId: "cmd-1", bodyType: "DeclareWar" },
          diagnostics: [],
        };
      throw new Error(`unexpected command ${command}`);
    });

    const { result } = renderHook(() => useDiplomacyScreen("ses_1"));
    await waitFor(() => expect(result.current.state.kind).toBe("loaded"));

    act(() => {
      result.current.setRowAction("france", "DeclareWar");
    });
    await act(async () => {
      result.current.submit();
    });

    await waitFor(() =>
      expect(mocks.execute).toHaveBeenCalledWith(
        "submitDiplomacyCommand",
        expect.objectContaining({
          sessionId: "ses_1",
          expectedRevision: 1,
          command: { type: "DeclareWar", targetNationId: "france" },
        }),
      ),
    );
    expect(result.current.state.kind).toBe("submitted");
  });
});
