import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useFleetInspectionCache } from "./useFleetInspection.js";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  revision: { current: 1 as number | null },
}));
vi.mock("../../../lib/bridge-context.js", () => ({
  useBridge: () => ({ campaign: { execute: mocks.execute } }),
}));
vi.mock("../../../shell/CampaignShellContext.js", () => ({
  useCampaignRevision: () => mocks.revision.current,
}));

const success = { outcome: "success", value: { revision: 1 } };

describe("useFleetInspectionCache", () => {
  afterEach(() => {
    cleanup();
    mocks.execute.mockReset();
    mocks.revision.current = 1;
  });

  it("reads the fleet screen once for every load at the same campaign revision", async () => {
    mocks.execute.mockResolvedValue(success);
    const { result } = renderHook(() => useFleetInspectionCache("ses-1"));
    await Promise.all([result.current(), result.current()]);
    await result.current();
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.execute).toHaveBeenCalledWith("inspectFleetScreen", "ses-1");
  });

  it("reads again once the campaign revision changes", async () => {
    mocks.execute.mockResolvedValue(success);
    const { result, rerender } = renderHook(() => useFleetInspectionCache("ses-1"));
    await result.current();
    mocks.revision.current = 2;
    rerender();
    await result.current();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed read, so the next load retries", async () => {
    mocks.execute.mockResolvedValueOnce({ outcome: "error", reason: "X", diagnostics: [] });
    mocks.execute.mockResolvedValueOnce(success);
    const { result } = renderHook(() => useFleetInspectionCache("ses-1"));
    await result.current();
    await result.current();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
});
