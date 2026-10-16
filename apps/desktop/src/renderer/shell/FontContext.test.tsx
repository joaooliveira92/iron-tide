/* @vitest-environment jsdom */
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import {
  createPreferencesBridgeStub,
  type PreferencesBridgeStub,
} from "../lib/preferences-test-bridge.js";
import { DEFAULT_SANS_FONT, FontProvider, useFont } from "./FontContext.js";

function wrapperFor(stub: PreferencesBridgeStub) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return (
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <FontProvider>{children}</FontProvider>
        </PreferencesProvider>
      </BridgeProvider>
    );
  };
}

describe("font preference", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["font"];
  });
  afterEach(cleanup);

  it("defaults to Inter when the domain holds no stored choice", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useFont(), { wrapper: wrapperFor(stub) });
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    expect(DEFAULT_SANS_FONT).toBe("inter");
    expect(result.current.font).toBe("inter");
  });

  it("sets the html attribute immediately, and writes the domain when changed", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useFont(), { wrapper: wrapperFor(stub) });
    await waitFor(() => expect(result.current.font).toBe("inter"));
    expect(document.documentElement.dataset["font"]).toBe("inter");

    act(() => result.current.setFont("jakarta"));
    await waitFor(() => expect(result.current.font).toBe("jakarta"));
    expect(document.documentElement.dataset["font"]).toBe("jakarta");

    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.font).toBe("jakarta");
    expect(localStorage.getItem("bluewave-font")).toBeNull();
  });

  it("restores a stored domain choice on the next start", async () => {
    const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES, font: "jakarta" });
    function Probe() {
      return <span>{useFont().font}</span>;
    }
    render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <FontProvider>
            <Probe />
          </FontProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    expect(await screen.findByText("jakarta")).toBeTruthy();
    expect(document.documentElement.dataset["font"]).toBe("jakarta");
  });

  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useFont())).toThrow(/FontProvider/);
  });
});
