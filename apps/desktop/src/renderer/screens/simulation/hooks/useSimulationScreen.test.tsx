import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { CampaignCommandClient } from "../../../../shared/campaign-contract.js";
import { useSimulationScreen, type SimulationCommandPort } from "./useSimulationScreen.js";

afterEach(cleanup);

function portWith(revision: number): {
  readonly port: SimulationCommandPort;
  readonly execute: ReturnType<typeof vi.fn<CampaignCommandClient["execute"]>>;
} {
  const execute = vi.fn<CampaignCommandClient["execute"]>(
    async () =>
      ({
        outcome: "success",
        value: { projection: { revision, playerNationId: "gb" } },
        diagnostics: [],
      }) as Partial<Awaited<ReturnType<CampaignCommandClient["execute"]>>> as Awaited<
        ReturnType<CampaignCommandClient["execute"]>
      >,
  );
  const port = { campaign: { execute } } as Partial<SimulationCommandPort> as SimulationCommandPort;
  return { port, execute };
}

describe("simulation screen loading", () => {
  it("reads the campaign snapshot once on mount and exposes the player nation", async () => {
    const { port, execute } = portWith(4);

    const { result } = renderHook(() => useSimulationScreen("s1", { bridge: port }));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.playerNationId).toBe("gb");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("reloads only when the shell reports a campaign revision other than the loaded one", async () => {
    const { port, execute } = portWith(4);

    const { result, rerender } = renderHook(
      ({ campaignRevision }: { readonly campaignRevision: number | undefined }) =>
        useSimulationScreen("s1", {
          bridge: port,
          ...(campaignRevision === undefined ? {} : { campaignRevision }),
        }),
      { initialProps: { campaignRevision: undefined as number | undefined } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(execute).toHaveBeenCalledTimes(1);

    rerender({ campaignRevision: 4 });
    expect(execute).toHaveBeenCalledTimes(1);

    rerender({ campaignRevision: 5 });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
  });

  it("loads again for a different session or bridge", async () => {
    const first = portWith(4);
    const second = portWith(9);

    const { result, rerender } = renderHook(
      ({ sessionId, port }: { readonly sessionId: string; readonly port: SimulationCommandPort }) =>
        useSimulationScreen(sessionId, { bridge: port }),
      { initialProps: { sessionId: "s1", port: first.port } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ sessionId: "s2", port: first.port });
    await waitFor(() => expect(first.execute).toHaveBeenCalledTimes(2));

    rerender({ sessionId: "s2", port: second.port });
    await waitFor(() => expect(second.execute).toHaveBeenCalledTimes(1));
  });
});
