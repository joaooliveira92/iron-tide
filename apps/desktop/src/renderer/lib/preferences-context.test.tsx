import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "./bridge-context.js";
import { PreferencesProvider, useCurrencyDisplayMode } from "./preferences-context.js";
import { createPreferencesBridgeStub } from "./preferences-test-bridge.js";

function makeWrapper(bridge: BluewaveDesktopBridge) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <BridgeProvider bridge={bridge}>
        <PreferencesProvider>{children}</PreferencesProvider>
      </BridgeProvider>
    );
  };
}

describe("useCurrencyDisplayMode", () => {
  it("exposes the requested mode and a Naval Credits effective mode by default", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useCurrencyDisplayMode(), {
      wrapper: makeWrapper(stub.bridge),
    });
    await act(async () => {});
    expect(result.current.requested).toBe("navalCredits");
    expect(result.current.effective).toBe("navalCredits");
    expect(result.current.fallbackReason).toBeUndefined();
  });

  it("persists a request change and keeps it while the effective mode falls back", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useCurrencyDisplayMode(), {
      wrapper: makeWrapper(stub.bridge),
    });
    await act(async () => {});

    act(() => result.current.setRequested("nationalHistorical"));
    await act(async () => {});

    expect(result.current.requested).toBe("nationalHistorical");
    expect(result.current.effective).toBe("navalCredits");
    expect(result.current.fallbackReason).toBe("noActiveNation");
    expect(stub.writes.at(-1)?.app.currencyDisplayMode).toBe("nationalHistorical");
    expect(stub.current().app.currencyDisplayMode).toBe("nationalHistorical");
  });

  it("honours National Historical when a validated configuration applies", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      currencyDisplayMode: "nationalHistorical",
    });
    const { result } = renderHook(() => useCurrencyDisplayMode({ kind: "configured" }), {
      wrapper: makeWrapper(stub.bridge),
    });
    await waitFor(() => expect(result.current.requested).toBe("nationalHistorical"));
    expect(result.current.effective).toBe("nationalHistorical");
    expect(result.current.fallbackReason).toBeUndefined();
  });

  it("never rewrites the stored request when the effective mode falls back", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      currencyDisplayMode: "nationalHistorical",
    });
    const { result } = renderHook(() => useCurrencyDisplayMode(), {
      wrapper: makeWrapper(stub.bridge),
    });
    await waitFor(() => expect(result.current.requested).toBe("nationalHistorical"));
    expect(result.current.effective).toBe("navalCredits");
    expect(result.current.fallbackReason).toBe("noActiveNation");
    expect(stub.writes).toHaveLength(0);
    expect(stub.current().app.currencyDisplayMode).toBe("nationalHistorical");
  });
});
