import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useConstructionScreen } from "./useConstructionScreen.js";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
}));

afterEach(() => {
  cleanup();
  mocks.execute.mockReset();
});

const projection = {
  revision: 3,
  month: { month: 1, year: 1880 },
  economy: {
    treasury: 1_000,
    monthlyAppropriation: 0,
    shipyardCapacity: 2,
    dockMaxBuildDisplacementKg: 13_000_000,
    maxConcurrentConstructionMassKg: 39_000_000,
    committedNewConstructionMassKg: 0,
    exemptNewConstructionMassKg: 0,
    dockExpansionDurationMonths: 12,
    dockExpansionNextStepKg: 1_000_000,
    dockPossessions: [{ id: "pos-1", name: "Portsmouth" }],
  },
  designs: [{ designId: "d1" }],
  projects: [],
  workspace: { commands: [], treasuryReserved: 0, capacityReserved: 0 },
};

describe("useConstructionScreen dock expansion (SB3-R16)", () => {
  it("issues authorizeDockExpansionCommand with the possession and current revision", async () => {
    mocks.execute.mockImplementation(async (command: string) => {
      if (command === "inspectConstructionScreen")
        return { outcome: "success", value: projection, diagnostics: [] };
      if (command === "authorizeDockExpansionCommand")
        return {
          outcome: "success",
          value: {
            commandId: "cmd-1",
            bodyType: "AuthorizeDockExpansion",
            appliedOnNextTurn: true,
          },
          diagnostics: [],
        };
      throw new Error(`unexpected command ${command}`);
    });

    const { result } = renderHook(() => useConstructionScreen("ses_1"));
    await waitFor(() => expect(result.current.state.revision).toBe(3));

    await act(async () => {
      result.current.authorizeDockExpansion("pos-1");
    });

    await waitFor(() =>
      expect(mocks.execute).toHaveBeenCalledWith(
        "authorizeDockExpansionCommand",
        expect.objectContaining({
          sessionId: "ses_1",
          possessionId: "pos-1",
          expectedRevision: 3,
        }),
      ),
    );
    await waitFor(() =>
      expect(result.current.state.notice).toMatch(/AuthorizeDockExpansion queued/),
    );
  });
});

describe("useConstructionScreen cancel project (DESIGN-23 section 23)", () => {
  it("issues cancelConstructionProjectCommand with the project and current revision", async () => {
    mocks.execute.mockImplementation(async (command: string) => {
      if (command === "inspectConstructionScreen")
        return { outcome: "success", value: projection, diagnostics: [] };
      if (command === "cancelConstructionProjectCommand")
        return {
          outcome: "success",
          value: {
            commandId: "cmd-cancel",
            bodyType: "CancelConstructionProject",
            appliedOnNextTurn: true,
          },
          diagnostics: [],
        };
      throw new Error(`unexpected command ${command}`);
    });

    const { result } = renderHook(() => useConstructionScreen("ses_1"));
    await waitFor(() => expect(result.current.state.revision).toBe(3));

    await act(async () => {
      result.current.cancelProject("proj-1");
    });

    await waitFor(() =>
      expect(mocks.execute).toHaveBeenCalledWith(
        "cancelConstructionProjectCommand",
        expect.objectContaining({
          sessionId: "ses_1",
          projectId: "proj-1",
          expectedRevision: 3,
        }),
      ),
    );
    await waitFor(() =>
      expect(result.current.state.notice).toMatch(/CancelConstructionProject queued/),
    );
  });
});

describe("useConstructionScreen batch order and preview (SB3-R11/R30)", () => {
  it("issues orderConstructionBatchCommand with the chosen design and quantity", async () => {
    mocks.execute.mockImplementation(async (command: string) => {
      if (command === "inspectConstructionScreen")
        return { outcome: "success", value: projection, diagnostics: [] };
      if (command === "orderConstructionBatchCommand")
        return {
          outcome: "success",
          value: {
            commandId: "cmd-batch",
            bodyType: "OrderConstruction",
            appliedOnNextTurn: true,
          },
          diagnostics: [],
        };
      throw new Error(`unexpected command ${command}`);
    });

    const { result } = renderHook(() => useConstructionScreen("ses_1"));
    await waitFor(() => expect(result.current.state.revision).toBe(3));

    await act(async () => {
      result.current.orderBatch("d1", 4);
    });

    await waitFor(() =>
      expect(mocks.execute).toHaveBeenCalledWith(
        "orderConstructionBatchCommand",
        expect.objectContaining({
          sessionId: "ses_1",
          designVersionId: "d1",
          quantity: 4,
          expectedRevision: 3,
        }),
      ),
    );
    await waitFor(() => expect(result.current.state.notice).toMatch(/OrderConstruction queued/));
  });

  it("fetches the engine preview through the read-only bridge command", async () => {
    const enginePreview = {
      ok: true,
      preview: {
        designVersionId: "d1",
        quantity: 2,
        names: [{ name: "Devastation", pool: "name_pool:uk:B", ordinal: 1 }],
        namePoolExhausted: false,
        dockCeilingKg: 13_000_000,
        designDisplacementKg: 11_880_000,
        fitsDock: true,
        yardId: "yard-uk-1",
      },
    };
    mocks.execute.mockImplementation(async (command: string) => {
      if (command === "inspectConstructionScreen")
        return { outcome: "success", value: projection, diagnostics: [] };
      if (command === "previewConstructionBatchCommand")
        return { outcome: "success", value: enginePreview, diagnostics: [] };
      throw new Error(`unexpected command ${command}`);
    });

    const { result } = renderHook(() => useConstructionScreen("ses_1"));
    await waitFor(() => expect(result.current.state.revision).toBe(3));

    const preview = await result.current.previewBatch("d1", 2);

    expect(preview).toEqual(enginePreview);
    expect(mocks.execute).toHaveBeenCalledWith("previewConstructionBatchCommand", {
      sessionId: "ses_1",
      designVersionId: "d1",
      quantity: 2,
    });
  });

  it("surfaces a bridge error as an ok:false preview with the engine's reason", async () => {
    mocks.execute.mockImplementation(async (command: string) => {
      if (command === "inspectConstructionScreen")
        return { outcome: "success", value: projection, diagnostics: [] };
      if (command === "previewConstructionBatchCommand")
        return { outcome: "error", reason: "SESSION_NOT_FOUND", diagnostics: ["gone"] };
      throw new Error(`unexpected command ${command}`);
    });

    const { result } = renderHook(() => useConstructionScreen("ses_1"));
    await waitFor(() => expect(result.current.state.revision).toBe(3));

    const preview = await result.current.previewBatch("d1", 2);
    expect(preview).toEqual({ ok: false, reason: "SESSION_NOT_FOUND", diagnostics: ["gone"] });
  });
});
