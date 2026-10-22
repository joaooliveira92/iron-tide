/* @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
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
});
