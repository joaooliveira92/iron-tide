/* @vitest-environment jsdom */
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import {
  createPreferencesBridgeStub,
  type PreferencesBridgeStub,
} from "../lib/preferences-test-bridge.js";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { DensityProvider, useDensity } from "./DensityContext.js";

function wrapperFor(stub: PreferencesBridgeStub) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return (
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>{children}</DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>
    );
  };
}

describe("density", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["density"];
  });
  afterEach(cleanup);

  it("defaults to comfortable and reads it from the preferences domain", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useDensity(), { wrapper: wrapperFor(stub) });
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    expect(result.current.density).toBe("comfortable");
    expect(document.documentElement.dataset["density"]).toBe("comfortable");
  });

  it("sets the html attribute immediately, and writes the domain when changed", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useDensity(), { wrapper: wrapperFor(stub) });
    await waitFor(() => expect(result.current.density).toBe("comfortable"));

    act(() => result.current.setDensity("compact"));
    await waitFor(() => expect(result.current.density).toBe("compact"));
    expect(document.documentElement.dataset["density"]).toBe("compact");

    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.interfaceDensity).toBe("compact");
    expect(stub.current().app.interfaceDensity).toBe("compact");
    expect(localStorage.getItem("bluewave-density")).toBeNull();
  });

  it("restores a stored domain choice on the next start", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      interfaceDensity: "compact",
    });
    function Probe() {
      return <span>{useDensity().density}</span>;
    }
    render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>
            <Probe />
          </DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    expect(await screen.findByText("compact")).toBeTruthy();
    expect(document.documentElement.dataset["density"]).toBe("compact");
  });

  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useDensity())).toThrow(/DensityProvider/);
  });
});
