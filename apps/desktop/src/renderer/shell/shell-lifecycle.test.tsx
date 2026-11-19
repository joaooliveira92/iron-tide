/* @vitest-environment jsdom */
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { WindowState } from "../../shared/bridge-contract.js";
import type { UiStateFirstMonthInspection } from "../../shared/ui-state-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import {
  CampaignShellProvider,
  useCampaignShellActions,
  useLeaveGuard,
} from "./CampaignShellContext.js";
import { emptyInspection } from "./guided-inspection-state.js";
import { ShellWindow } from "./shell-sections.js";
import { useGuidedInspection } from "./useGuidedInspection.js";
import { useWindowContext } from "./WindowContext.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ok = <T,>(value: T) => ({ outcome: "success" as const, value, diagnostics: [] });

describe("leave guard registration", () => {
  function Probe({
    guard,
    onReady,
  }: {
    readonly guard: (target: string) => boolean;
    readonly onReady: (api: {
      readonly leave: (target: "overview") => void;
      readonly select: (screen: "treasury") => void;
    }) => void;
  }) {
    const leave = useLeaveGuard(guard);
    const actions = useCampaignShellActions();
    onReady({ leave, select: actions.selectScreen });
    return null;
  }

  function mount(guard: (target: string) => boolean) {
    let api: Parameters<Parameters<typeof Probe>[0]["onReady"]>[0] | undefined;
    const view = render(
      <CampaignShellProvider bridge={undefined}>
        <Probe guard={guard} onReady={(next) => (api = next)} />
      </CampaignShellProvider>,
    );
    return { ...view, api: () => api! };
  }

  it("lets the latest guard veto navigation while mounted", () => {
    const guard = vi.fn(() => false);
    const { api } = mount(guard);
    act(() => api().select("treasury"));
    expect(guard).toHaveBeenCalledWith("treasury");
  });

  it("stops consulting the guard once unmounted", () => {
    const guard = vi.fn(() => false);
    let actions: ReturnType<typeof useCampaignShellActions> | undefined;
    function Keep() {
      actions = useCampaignShellActions();
      return null;
    }
    function Host({ show }: { readonly show: boolean }) {
      return (
        <CampaignShellProvider bridge={undefined}>
          <Keep />
          {show ? <Probe guard={guard} onReady={() => {}} /> : null}
        </CampaignShellProvider>
      );
    }
    const view = render(<Host show />);
    act(() => actions!.selectScreen("treasury"));
    expect(guard).toHaveBeenCalledTimes(1);
    view.rerender(<Host show={false} />);
    act(() => actions!.selectScreen("fleet"));
    expect(guard).toHaveBeenCalledTimes(1);
  });

  it("bypasses the guard for the navigation it confirms itself", () => {
    const guard = vi.fn(() => false);
    const { api } = mount(guard);
    act(() => api().leave("overview"));
    expect(guard).not.toHaveBeenCalled();
  });
});

describe("window state", () => {
  const loaded: WindowState = {
    platform: "win32",
    isMaximized: true,
    maximizable: true,
    minimizable: false,
  };

  function Show() {
    const { windowState } = useWindowContext();
    return <span data-testid="state">{JSON.stringify(windowState)}</span>;
  }

  function mount(bridge: BluewaveDesktopBridge | undefined, initial?: WindowState) {
    return render(
      <CampaignShellProvider bridge={bridge}>
        <ShellWindow bridge={bridge} initialWindowState={initial}>
          <Show />
        </ShellWindow>
      </CampaignShellProvider>,
    );
  }

  function windowBridge(getWindowState: () => Promise<WindowState>) {
    return { platform: "win32", getWindowState } as BluewaveDesktopBridge;
  }

  it("shows defaults, then the state the bridge reports", async () => {
    const getWindowState = vi.fn(async () => loaded);
    mount(windowBridge(getWindowState));
    expect(JSON.parse(screen.getByTestId("state").textContent!)).toMatchObject({
      isMaximized: false,
      minimizable: true,
    });
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId("state").textContent!)).toEqual(loaded),
    );
    expect(getWindowState).toHaveBeenCalledTimes(1);
  });

  it("keeps defaults when the bridge read fails", async () => {
    const getWindowState = vi.fn(async () => {
      throw new Error("ipc down");
    });
    mount(windowBridge(getWindowState));
    await waitFor(() => expect(getWindowState).toHaveBeenCalled());
    await act(async () => {});
    expect(JSON.parse(screen.getByTestId("state").textContent!)).toMatchObject({
      isMaximized: false,
    });
  });

  it("uses the supplied initial state without asking the bridge", async () => {
    const getWindowState = vi.fn(async () => loaded);
    const initial: WindowState = { ...loaded, isMaximized: false };
    mount(windowBridge(getWindowState), initial);
    await act(async () => {});
    expect(getWindowState).not.toHaveBeenCalled();
    expect(JSON.parse(screen.getByTestId("state").textContent!)).toEqual(initial);
  });

  it("renders defaults without a bridge", async () => {
    mount(undefined);
    await act(async () => {});
    expect(JSON.parse(screen.getByTestId("state").textContent!)).toMatchObject({
      platform: "darwin",
      isMaximized: false,
    });
  });
});

describe("guided inspection", () => {
  function uiBridge(initial: UiStateFirstMonthInspection | undefined) {
    let stored = initial;
    const execute = vi.fn(async (command: string, arg: unknown) => {
      if (command === "writeUiState") {
        const patch = arg as { firstMonthInspection?: UiStateFirstMonthInspection };
        stored = patch.firstMonthInspection ?? stored;
      }
      return ok({ uiState: stored === undefined ? {} : { firstMonthInspection: stored } });
    });
    const bridge = { campaign: { execute } } as BluewaveDesktopBridge;
    return { bridge, execute, stored: () => stored };
  }

  function mount(bridge: BluewaveDesktopBridge, sessionId: string | null) {
    const wrapper = ({ children }: { readonly children: ReactNode }) => (
      <BridgeProvider bridge={bridge}>{children}</BridgeProvider>
    );
    return renderHook(
      ({ id }: { readonly id: string | null }) => useGuidedInspection({ sessionId: id }),
      { wrapper, initialProps: { id: sessionId } },
    );
  }

  it("opens at step 0 for a campaign with no stored inspection", async () => {
    const { bridge } = uiBridge(undefined);
    const { result } = mount(bridge, "s1");
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ visible: true, stepIndex: 0 });
    expect(result.current.inspection).toEqual(emptyInspection());
  });

  it("resumes an in-progress inspection after the last completed step", async () => {
    const { bridge } = uiBridge({ status: "in_progress", lastCompletedStep: 2 });
    const { result } = mount(bridge, "s1");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visible).toBe(true);
    expect(result.current.stepIndex).toBe(3);
  });

  it("stays hidden for a finished inspection", async () => {
    const { bridge } = uiBridge({ status: "completed", lastCompletedStep: 6 });
    const { result } = mount(bridge, "s1");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ visible: false, stepIndex: 0 });
  });

  it("is idle without a session", async () => {
    const { bridge, execute } = uiBridge(undefined);
    const { result } = mount(bridge, null);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visible).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("advances, persists, and dismisses", async () => {
    const { bridge, stored } = uiBridge(undefined);
    const { result } = mount(bridge, "s1");
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.advance(0));
    expect(result.current.stepIndex).toBe(1);
    expect(stored()?.status).toBe("in_progress");
    await act(() => result.current.dismiss(1));
    expect(result.current.visible).toBe(false);
    expect(stored()?.status).toBe("dismissed");
  });

  it("restarts from the first step and can be hidden by the caller", async () => {
    const { bridge, stored } = uiBridge({ status: "dismissed", lastCompletedStep: 1 });
    const { result } = mount(bridge, "s1");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visible).toBe(false);
    await act(() => result.current.restart());
    expect(result.current).toMatchObject({ visible: true, stepIndex: 0 });
    expect(stored()?.status).toBe("not_started");
    act(() => result.current.setVisible(false));
    expect(result.current.visible).toBe(false);
  });

  it("reloads when the session changes", async () => {
    const { bridge, execute } = uiBridge(undefined);
    const { result, rerender } = mount(bridge, "s1");
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ id: "s2" });
    await waitFor(() =>
      expect(execute.mock.calls.filter(([command]) => command === "readUiState")).toHaveLength(2),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visible).toBe(true);
  });
});
