import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import type { CampaignCommandClient } from "../../../shared/campaign-contract.js";
import { BridgeProvider } from "../../lib/bridge-context.js";
import { inspectMapFixture } from "../../lib/inspect-map-fixture.js";
import { MAP_SHAPE_REJECTED_MESSAGE } from "../../lib/map-read.js";
import { useLiveWorldMapOverlay } from "./useLiveWorldMapOverlay.js";

afterEach(cleanup);

function wrapperFor(value: unknown) {
  const execute = vi.fn(async () => ({
    outcome: "success" as const,
    value,
    diagnostics: [],
  }));
  const campaign: CampaignCommandClient = { execute: execute as CampaignCommandClient["execute"] };
  const bridge: Pick<BluewaveDesktopBridge, "campaign"> = { campaign };
  return ({ children }: { readonly children: ReactNode }) => (
    <BridgeProvider bridge={bridge as BluewaveDesktopBridge}>{children}</BridgeProvider>
  );
}

describe("useLiveWorldMapOverlay", () => {
  it("joins the strategic world of a contract-conforming inspectMap result", async () => {
    const result = renderHook(() => useLiveWorldMapOverlay("ses-1", 1), {
      wrapper: wrapperFor(inspectMapFixture()),
    });

    await waitFor(() => expect(result.result.current.status).toBe("ready"));
    expect(result.result.current.overlay.playerNationId).toBe("uk");
    expect(result.result.current.strategic).not.toBeNull();
  });

  it("degrades to unavailable when the result lacks strategic instead of throwing", async () => {
    const result = renderHook(() => useLiveWorldMapOverlay("ses-2", 1), {
      wrapper: wrapperFor({ revision: 1, playerNationId: "uk" }),
    });

    await waitFor(() => expect(result.result.current.status).toBe("unavailable"));
    expect(result.result.current.reason).toBe(MAP_SHAPE_REJECTED_MESSAGE);
    expect(result.result.current.strategic).toBeNull();
  });
});
