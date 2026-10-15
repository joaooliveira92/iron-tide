import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import type { CampaignCommandClient } from "../../../shared/campaign-command-contract.js";
import { BridgeProvider } from "../../lib/bridge-context.js";
import { useInspectorLayout } from "./useInspectorLayout.js";

afterEach(cleanup);

const uiState = (inspector?: unknown, dismissedFingerprints: string[] = []) => ({
  outcome: "success",
  value: { uiState: { turnNumber: 0, dismissedFingerprints, ...(inspector ? { inspector } : {}) } },
  diagnostics: [],
});

const wrapper = (execute: ReturnType<typeof vi.fn>) => {
  const bridge = {
    campaign: { execute: execute as CampaignCommandClient["execute"] },
  } as Partial<BluewaveDesktopBridge> as BluewaveDesktopBridge;
  return ({ children }: { readonly children: ReactNode }) => (
    <BridgeProvider bridge={bridge}>{children}</BridgeProvider>
  );
};

describe("useInspectorLayout", () => {
  it("reads the remembered layout from the sidecar on mount", async () => {
    const execute = vi.fn(async (command: string) =>
      command === "readUiState" ? uiState({ widthPx: 512, collapsed: true }) : uiState(),
    );
    const { result } = renderHook(() => useInspectorLayout("ses_1"), { wrapper: wrapper(execute) });
    await waitFor(() => expect(result.current.layout).toEqual({ widthPx: 512, collapsed: true }));
  });

  it("writes the chosen width through the sidecar, carrying the dismissal set through", async () => {
    const execute = vi.fn(async (command: string) =>
      command === "readUiState" ? uiState(undefined, ["fp-a"]) : uiState(),
    );
    const { result } = renderHook(() => useInspectorLayout("ses_1"), { wrapper: wrapper(execute) });
    act(() => result.current.setWidth(600));
    expect(result.current.layout.widthPx).toBe(560);
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith("writeUiState", {
        sessionId: "ses_1",
        dismissedFingerprints: ["fp-a"],
        inspector: { widthPx: 560, collapsed: false },
      }),
    );
  });

  it("keeps the choice for the session when there is no campaign session to store it against", async () => {
    const execute = vi.fn(async () => uiState());
    const { result } = renderHook(() => useInspectorLayout(undefined), {
      wrapper: wrapper(execute),
    });
    act(() => result.current.toggleCollapsed());
    expect(result.current.layout.collapsed).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(execute).not.toHaveBeenCalled();
  });

  it("flushes a resize that lands just before unmount, so the last change is remembered", async () => {
    const execute = vi.fn(async (command: string) =>
      command === "readUiState" ? uiState(undefined, []) : uiState(),
    );
    const { result, unmount } = renderHook(() => useInspectorLayout("ses_1"), {
      wrapper: wrapper(execute),
    });
    act(() => result.current.setWidth(500));
    unmount();
    await waitFor(() =>
      expect(execute).toHaveBeenCalledWith("writeUiState", {
        sessionId: "ses_1",
        dismissedFingerprints: [],
        inspector: { widthPx: 500, collapsed: false },
      }),
    );
  });
});
