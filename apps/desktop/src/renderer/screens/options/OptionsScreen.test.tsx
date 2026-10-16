/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { BridgeProvider } from "../../lib/bridge-context.js";
import { PreferencesProvider } from "../../lib/preferences-context.js";
import {
  createPreferencesBridgeStub,
  type PreferencesBridgeStub,
} from "../../lib/preferences-test-bridge.js";
import { BackgroundProvider } from "../../shell/BackgroundContext.js";
import { DensityProvider } from "../../shell/DensityContext.js";
import { FontProvider } from "../../shell/FontContext.js";
import { ThemeProvider } from "../../shell/ThemeContext.js";
import { OptionsScreen } from "./OptionsScreen.js";

beforeEach(() => {
  // jsdom has no matchMedia; ThemeContext and DisplayPreferencesProvider read it.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

function renderOptions(stub: PreferencesBridgeStub) {
  return render(
    <BridgeProvider bridge={stub.bridge}>
      <PreferencesProvider>
        <ThemeProvider>
          <BackgroundProvider>
            <FontProvider>
              <DensityProvider>
                <OptionsScreen />
              </DensityProvider>
            </FontProvider>
          </BackgroundProvider>
        </ThemeProvider>
      </PreferencesProvider>
    </BridgeProvider>,
  );
}

describe("OptionsScreen display density", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["density"];
    delete document.documentElement.dataset["font"];
  });
  afterEach(cleanup);

  it("offers Comfortable and Compact, starting on Comfortable", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    const group = screen.getByRole("group", { name: "Display density" });
    expect(group.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Comfortable" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("switches the whole app to compact and writes it to the domain, not localStorage", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    );
    expect(document.documentElement.dataset["density"]).toBe("compact");
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.interfaceDensity).toBe("compact");
    expect(localStorage.getItem("bluewave-density")).toBeNull();
  });

  it("no longer carries campaign file actions (they live in the header Campaign menu)", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Close Campaign/i })).toBeNull();
  });
});

describe("OptionsScreen application font", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["density"];
    delete document.documentElement.dataset["font"];
  });
  afterEach(cleanup);

  it("offers Inter and Plus Jakarta Sans, starting on Inter", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    const group = screen.getByRole("group", { name: "Application font" });
    expect(group.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Inter" }).getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Plus Jakarta Sans" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("switches the whole app font and writes it to the domain, not localStorage", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Plus Jakarta Sans" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Plus Jakarta Sans" }).getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    expect(document.documentElement.dataset["font"]).toBe("jakarta");
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.font).toBe("jakarta");
    expect(localStorage.getItem("bluewave-font")).toBeNull();
  });
});
