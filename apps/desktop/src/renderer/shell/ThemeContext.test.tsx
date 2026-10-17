/* @vitest-environment jsdom */
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../lib/preferences-test-bridge.js";
import { ThemeProvider, resolveTheme } from "./ThemeContext.js";

beforeEach(() => {
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
  document.documentElement.classList.remove("dark", "high-contrast");
});
afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark", "high-contrast");
});

describe("theme model (U-4 ticket 03)", () => {
  it("resolves high contrast to the dark base", () => {
    expect(resolveTheme("highContrast")).toBe("dark");
    expect(resolveTheme("light")).toBe("light");
  });

  it("applies the high-contrast class on the root", async () => {
    const stub = createPreferencesBridgeStub({
      ...DEFAULT_APP_PREFERENCES,
      theme: "highContrast",
    });
    render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <ThemeProvider>
            <span>content</span>
          </ThemeProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    await waitFor(() => {
      expect(document.documentElement.classList.contains("high-contrast")).toBe(true);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });
});
