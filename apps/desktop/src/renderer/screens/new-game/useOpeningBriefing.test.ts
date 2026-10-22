import { renderHook, waitFor } from "@testing-library/react";
import type { OpeningBriefingProjection } from "@bluewave/campaign-engine";
import { describe, expect, it, vi } from "vite-plus/test";

import type { InspectOpeningBriefingResult } from "../../../shared/campaign-contract.js";
import type { BridgeResult } from "../../../shared/bridge-contract.js";
import { useOpeningBriefing } from "./useOpeningBriefing.js";

const projection = {
  nationId: "gb",
  nationName: "United Kingdom",
  month: { month: 1, year: 1880 },
} as unknown as OpeningBriefingProjection;

describe("useOpeningBriefing", () => {
  it("loads the projection for the session", async () => {
    const load = vi.fn(
      async (_sessionId: string): Promise<BridgeResult<InspectOpeningBriefingResult>> => ({
        outcome: "success",
        value: { projection },
        diagnostics: [],
      }),
    );

    const { result } = renderHook(() => useOpeningBriefing("s1", load));

    await waitFor(() => expect(result.current.projection).toBe(projection));
    expect(result.current.error).toBeNull();
    expect(load).toHaveBeenCalledWith("s1");
  });

  it("reports the engine reason and leaves the projection empty on failure", async () => {
    const load = vi.fn(
      async (_sessionId: string): Promise<BridgeResult<InspectOpeningBriefingResult>> => ({
        outcome: "error",
        reason: "SESSION_NOT_FOUND",
        diagnostics: [],
      }),
    );

    const { result } = renderHook(() => useOpeningBriefing("s1", load));

    await waitFor(() => expect(result.current.error).toBe("SESSION_NOT_FOUND"));
    expect(result.current.projection).toBeNull();
  });
});
