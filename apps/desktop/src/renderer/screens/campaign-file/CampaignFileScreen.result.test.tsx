/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { BridgeProvider } from "../../lib/bridge-context.js";
import { CampaignFileScreen } from "./CampaignFileScreen.js";

const ResizeObserverMock = vi.hoisted(
  () =>
    class implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
);
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

type Handler = (command: string) => unknown;

function renderScreen(handler: Handler) {
  const execute = vi.fn(async (command: string) => handler(command));
  const bridge = { campaign: { execute } } as never;
  return render(
    <BridgeProvider bridge={bridge}>
      <CampaignFileScreen onOpenCampaign={vi.fn()} onStartNewGame={vi.fn()} />
    </BridgeProvider>,
  );
}

const ok = (value: unknown) => ({ outcome: "success", value, diagnostics: [] });
const fail = (reason: string) => ({ outcome: "error", reason, diagnostics: [] });
const VERIFIED = ok({
  valid: true,
  campaignIdentity: "abcdefabcdef123",
  activeRevision: 2,
  issues: [],
});

async function settle(): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  });
}

describe("CampaignFileScreen operation result lifetime", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("dismisses a successful result after fifteen seconds", async () => {
    renderScreen((command) => (command === "listRecentCampaigns" ? ok([]) : VERIFIED));
    await settle();
    fireEvent.click(screen.getByText("Verify"));
    await settle();
    expect(screen.queryByText(/Package verified/)).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(14_999);
    });
    expect(screen.queryByText(/Package verified/)).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText(/Package verified/)).toBeNull();
  });

  it("keeps an error until it is replaced or dismissed", async () => {
    renderScreen((command) => (command === "listRecentCampaigns" ? ok([]) : fail("VERIFY_FAILED")));
    await settle();
    fireEvent.click(screen.getByText("Verify"));
    await settle();
    expect(screen.queryByText(/VERIFY_FAILED/)).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(screen.queryByText(/VERIFY_FAILED/)).not.toBeNull();
  });

  it("restarts the countdown when a newer result replaces an older one", async () => {
    renderScreen((command) => (command === "listRecentCampaigns" ? ok([]) : VERIFIED));
    await settle();
    fireEvent.click(screen.getByText("Verify"));
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    fireEvent.click(screen.getByText("Verify"));
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByText(/Package verified/)).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.queryByText(/Package verified/)).toBeNull();
  });

  it("leaves no timer behind when the screen unmounts", async () => {
    const view = renderScreen((command) => (command === "listRecentCampaigns" ? ok([]) : VERIFIED));
    await settle();
    fireEvent.click(screen.getByText("Verify"));
    await settle();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
