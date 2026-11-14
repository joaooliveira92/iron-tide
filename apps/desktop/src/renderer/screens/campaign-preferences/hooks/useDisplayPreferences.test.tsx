/* @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { BridgeProvider } from "../../../lib/bridge-context.js";
import {
  createPreferencesBridgeStub,
  type PreferencesBridgeStub,
} from "../../../lib/preferences-test-bridge.js";
import { useDisplayPreferences } from "./useDisplayPreferences.js";

const SESSION = "sess-1";
const LEGACY_KEY = "bluewave-display-preferences";

function wrapper(stub: PreferencesBridgeStub) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <BridgeProvider bridge={stub.bridge}>{children}</BridgeProvider>;
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useDisplayPreferences campaign scope (U-2 ticket 05)", () => {
  it("persists a toggle to the campaign sidecar, not localStorage", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useDisplayPreferences(SESSION), {
      wrapper: wrapper(stub),
    });
    await waitFor(() => expect(result.current.displayPrefs.showSupplyOverlay).toBe(false));
    act(() => result.current.togglePref("showSupplyOverlay"));
    await waitFor(() => expect(stub.campaignWrites).toHaveLength(1));
    expect(stub.currentCampaign(SESSION).campaign.showSupplyOverlay).toBe(true);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it("writes once per toggle under StrictMode double-invoked updaters", async () => {
    const stub = createPreferencesBridgeStub();
    const strict = ({ children }: { children: ReactNode }) => (
      <StrictMode>{wrapper(stub)({ children })}</StrictMode>
    );
    const { result } = renderHook(() => useDisplayPreferences(SESSION), { wrapper: strict });
    await waitFor(() => expect(result.current.displayPrefs.showSupplyOverlay).toBe(false));
    act(() => result.current.togglePref("showSupplyOverlay"));
    await waitFor(() => expect(stub.campaignWrites).toHaveLength(1));
    expect(result.current.displayPrefs.showSupplyOverlay).toBe(true);
    expect(stub.campaignWrites).toHaveLength(1);
  });

  it("keeps displayPrefs and togglePref referentially stable across unrelated renders", async () => {
    const stub = createPreferencesBridgeStub();
    const { result, rerender } = renderHook(() => useDisplayPreferences(SESSION), {
      wrapper: wrapper(stub),
    });
    await act(async () => {});
    const before = result.current;
    rerender();
    expect(result.current.displayPrefs).toBe(before.displayPrefs);
    expect(result.current.togglePref).toBe(before.togglePref);
  });

  it("keeps togglePref stable when a session override changes", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useDisplayPreferences(SESSION), {
      wrapper: wrapper(stub),
    });
    await waitFor(() => expect(result.current.displayPrefs.showSupplyOverlay).toBe(false));
    const before = result.current.togglePref;
    act(() => result.current.setSessionOverride("confirmBeforeTurn", false));
    expect(result.current.togglePref).toBe(before);
  });

  it("drops a session override when its preference is toggled", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useDisplayPreferences(SESSION), {
      wrapper: wrapper(stub),
    });
    await waitFor(() => expect(result.current.displayPrefs.confirmBeforeTurn).toBe(true));
    act(() => result.current.setSessionOverride("confirmBeforeTurn", false));
    act(() => result.current.togglePref("confirmBeforeTurn"));
    await waitFor(() => expect(stub.campaignWrites).toHaveLength(1));
    expect(stub.campaignWrites[0]?.campaign.confirmBeforeTurn).toBe(true);
    expect(result.current.displayPrefs.confirmBeforeTurn).toBe(true);
  });

  it("resolves a session override ahead of campaign and drops it on remount", async () => {
    const stub = createPreferencesBridgeStub();
    const first = renderHook(() => useDisplayPreferences(SESSION), { wrapper: wrapper(stub) });
    await waitFor(() => expect(first.result.current.displayPrefs.confirmBeforeTurn).toBe(true));
    act(() => first.result.current.setSessionOverride("confirmBeforeTurn", false));
    expect(first.result.current.displayPrefs.confirmBeforeTurn).toBe(false);
    first.unmount();
    const second = renderHook(() => useDisplayPreferences(SESSION), { wrapper: wrapper(stub) });
    await waitFor(() => expect(second.result.current.displayPrefs.confirmBeforeTurn).toBe(true));
  });

  it("migrates the legacy localStorage value once, then clears the key", async () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        showDetailedTooltips: false,
        confirmBeforeTurn: false,
        showUnitFatigue: false,
        showSupplyOverlay: true,
      }),
    );
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useDisplayPreferences(SESSION), {
      wrapper: wrapper(stub),
    });
    await waitFor(() => expect(result.current.displayPrefs.showSupplyOverlay).toBe(true));
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    await waitFor(() =>
      expect(stub.currentCampaign(SESSION).campaign.showSupplyOverlay).toBe(true),
    );
  });

  it("keeps a toggle made before the initial campaign read resolves", async () => {
    const stub = createPreferencesBridgeStub();
    const realRead = stub.bridge.preferences.readCampaign.bind(stub.bridge.preferences);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let readSettled: Promise<void> = Promise.resolve();
    stub.bridge.preferences.readCampaign = (sessionId) => {
      const pending = realRead(sessionId);
      const delayed = gate.then(() => pending);
      readSettled = delayed.then(() => undefined);
      return delayed;
    };
    const { result } = renderHook(() => useDisplayPreferences(SESSION), {
      wrapper: wrapper(stub),
    });
    act(() => result.current.togglePref("showSupplyOverlay"));
    expect(result.current.displayPrefs.showSupplyOverlay).toBe(true);
    await waitFor(() => expect(stub.campaignWrites).toHaveLength(1));
    await act(async () => {
      release();
      await readSettled;
    });
    expect(result.current.displayPrefs.showSupplyOverlay).toBe(true);
    expect(stub.currentCampaign(SESSION).campaign.showSupplyOverlay).toBe(true);
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["a wrong-shaped object", JSON.stringify({ showSupplyOverlay: "yes", extra: 1 })],
    ["a partial object", JSON.stringify({ showSupplyOverlay: true })],
    ["a non-object value", JSON.stringify([true, false])],
  ])("discards %s in the legacy key without writing the sidecar", async (_label, raw) => {
    localStorage.setItem(LEGACY_KEY, raw);
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useDisplayPreferences(SESSION), {
      wrapper: wrapper(stub),
    });
    await waitFor(() => expect(localStorage.getItem(LEGACY_KEY)).toBeNull());
    await waitFor(() => expect(result.current.displayPrefs.confirmBeforeTurn).toBe(true));
    expect(stub.campaignWrites).toHaveLength(0);
    expect(result.current.displayPrefs.showSupplyOverlay).toBe(false);
  });
});
