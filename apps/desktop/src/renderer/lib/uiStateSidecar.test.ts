import { describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { CampaignCommandClient } from "../../shared/campaign-contract.js";
import { writeUiStatePatch } from "./uiStateSidecar.js";

const success = (uiState: unknown) => ({
  outcome: "success",
  value: { uiState },
  diagnostics: [],
});

function bridgeOver(execute: ReturnType<typeof vi.fn>): BluewaveDesktopBridge {
  return {
    campaign: { execute: execute as CampaignCommandClient["execute"] },
  } as Partial<BluewaveDesktopBridge> as BluewaveDesktopBridge;
}

describe("writeUiStatePatch", () => {
  it("sends only the fields the caller owns in a single command, with no read first", async () => {
    const execute = vi.fn(async () => success({ turnNumber: 0, dismissedFingerprints: [] }));
    await writeUiStatePatch(bridgeOver(execute), "ses_1", {
      inspector: { widthPx: 500, collapsed: true },
    });
    expect(execute.mock.calls).toEqual([
      ["writeUiState", { sessionId: "ses_1", inspector: { widthPx: 500, collapsed: true } }],
    ]);
  });

  it("returns the merged state main answers with", async () => {
    const merged = {
      turnNumber: 2,
      dismissedFingerprints: ["fp-a"],
      inspector: { widthPx: 500, collapsed: true },
    };
    const execute = vi.fn(async () => success(merged));
    expect(await writeUiStatePatch(bridgeOver(execute), "ses_1", {})).toEqual(merged);
  });

  it("answers undefined without a bridge or when main refuses the write", async () => {
    expect(await writeUiStatePatch(undefined, "ses_1", {})).toBeUndefined();
    const execute = vi.fn(async () => ({ outcome: "error", reason: "SESSION_NOT_FOUND" }));
    expect(await writeUiStatePatch(bridgeOver(execute), "ses_1", {})).toBeUndefined();
  });
});
