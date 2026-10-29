import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { encodeLog, newLog, pushEdit, type EditLog } from "@bluewave/ship-design";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import type { CampaignCommandClient } from "../../../shared/campaign-contract.js";
import { BridgeProvider } from "../../lib/bridge-context.js";
import { loadDrawingBoardContent } from "./content.js";
import { DraftSaveWarning } from "./DraftSaveWarning.js";
import { AUTOSAVE_DELAY_MS, DRAFT_RETRY_DELAY_MS, useDraftAutosave } from "./useDraftAutosave.js";

const writeFailure = {
  outcome: "error" as const,
  reason: "DRAFT_WRITE_FAILED",
  diagnostics: ["disk full"],
};
const writeSuccess = { outcome: "success" as const, value: { saved: true }, diagnostics: [] };

const reference = loadDrawingBoardContent().references.find((r) => r.month <= "1880-01")!;

function logWithPower(power: number): EditLog {
  return pushEdit(newLog(reference.draft), {
    kind: "set_machinery",
    patch: { installedKw: power },
  });
}

function makeBridge(results: Array<typeof writeFailure | typeof writeSuccess>) {
  const writes: Array<{ readonly sessionId: string; readonly draft: unknown }> = [];
  const execute = vi.fn<CampaignCommandClient["execute"]>((command, payload) => {
    if (command === "readDrawingBoardDraft") {
      return Promise.resolve({
        outcome: "success",
        value: { draft: null },
        diagnostics: [],
      } as never);
    }
    writes.push(payload as { readonly sessionId: string; readonly draft: unknown });
    return Promise.resolve((results.shift() ?? writeSuccess) as never);
  });
  const bridge: BluewaveDesktopBridge = {
    campaign: { execute },
    preferences: {
      read: () => Promise.resolve(writeSuccess as never),
      write: () => Promise.resolve(writeSuccess as never),
      readCampaign: () => Promise.resolve(writeSuccess as never),
      writeCampaign: () => Promise.resolve(writeSuccess as never),
    },
    platform: "darwin",
    readStartupSnapshot: () => Promise.reject(new Error("unused")),
    getWindowState: () => Promise.reject(new Error("unused")),
    windowMinimize: () => undefined,
    windowMaximizeToggle: () => undefined,
    windowClose: () => undefined,
  };
  return { bridge, writes };
}

function wrapperFor(bridge: BluewaveDesktopBridge) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <BridgeProvider bridge={bridge}>{children}</BridgeProvider>;
  };
}

function renderAutosave(bridge: BluewaveDesktopBridge, log: EditLog) {
  return renderHook(
    ({ currentLog }: { readonly currentLog: EditLog }) =>
      useDraftAutosave({
        sessionId: "session-1",
        presetId: "preset-1",
        log: currentLog,
        restore: () => false,
      }),
    { initialProps: { currentLog: log }, wrapper: wrapperFor(bridge) },
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useDraftAutosave retry", () => {
  it("keeps the failed draft queued and reports it unsaved", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { bridge, writes } = makeBridge([writeFailure]);
    const { result } = renderAutosave(bridge, logWithPower(2_500));

    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });

    expect(writes).toHaveLength(1);
    expect(result.current.saveFailed).toBe(true);
    expect(result.current.enabled).toBe(true);

    render(<DraftSaveWarning visible={result.current.saveFailed} onDismiss={() => undefined} />);
    expect(screen.getByRole("alert").textContent).toContain("not saved");
  });

  it("retries with the newest draft and clears the warning after success", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { bridge, writes } = makeBridge([writeFailure, writeSuccess]);
    const first = logWithPower(2_500);
    const second = logWithPower(2_700);
    const { result, rerender } = renderAutosave(bridge, first);

    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    expect(result.current.saveFailed).toBe(true);

    rerender({ currentLog: second });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    expect(writes).toHaveLength(2);
    expect((writes[1]?.draft as { readonly log: string }).log).toBe(encodeLog(second));
    expect(result.current.saveFailed).toBe(false);
  });

  it("retries a failed write without a further edit", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { bridge, writes } = makeBridge([writeFailure, writeSuccess]);
    const only = logWithPower(2_500);
    const { result } = renderAutosave(bridge, only);

    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    expect(result.current.saveFailed).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_RETRY_DELAY_MS);
    });
    expect(writes).toHaveLength(2);
    expect((writes[1]?.draft as { readonly log: string }).log).toBe(encodeLog(only));
    expect(result.current.saveFailed).toBe(false);
  });

  it("clears a dismissed warning on the next success and re-shows a later failure", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { bridge, writes } = makeBridge([writeFailure, writeSuccess, writeFailure]);
    const { result, rerender } = renderAutosave(bridge, logWithPower(2_500));

    await act(async () => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    expect(result.current.saveFailed).toBe(true);
    act(() => result.current.dismissSaveFailed());
    expect(result.current.saveFailed).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRAFT_RETRY_DELAY_MS);
    });
    expect(writes).toHaveLength(2);
    expect(result.current.saveFailed).toBe(false);

    rerender({ currentLog: logWithPower(3_000) });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    });
    expect(writes).toHaveLength(3);
    expect(result.current.saveFailed).toBe(true);
  });
});

describe("DraftSaveWarning", () => {
  it("is dismissible and hidden when there is no failure", () => {
    const dismiss = vi.fn();
    const { rerender } = render(<DraftSaveWarning visible onDismiss={dismiss} />);
    screen.getByRole("button", { name: "Dismiss" }).click();
    expect(dismiss).toHaveBeenCalledOnce();

    rerender(<DraftSaveWarning visible={false} onDismiss={dismiss} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
