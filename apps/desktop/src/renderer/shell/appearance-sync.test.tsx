/* @vitest-environment jsdom */
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import type { AppPreferences } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider, usePreferences } from "../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../lib/preferences-test-bridge.js";
import { DensityProvider } from "./DensityContext.js";
import { DisplayPreferencesProvider, useEffectiveReducedMotion } from "./display-preferences.js";
import { FontProvider } from "./FontContext.js";
import { ThemeProvider, useTheme } from "./ThemeContext.js";

class FakeMedia extends EventTarget implements MediaQueryList {
  matches = false;
  onchange: MediaQueryList["onchange"] = null;
  readonly listeners = new Set<EventListenerOrEventListenerObject>();

  constructor(readonly media: string) {
    super();
  }

  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (listener !== null) this.listeners.add(listener);
    super.addEventListener(type, listener, options);
  }

  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void {
    if (listener !== null) this.listeners.delete(listener);
    super.removeEventListener(type, listener, options);
  }

  addListener(): void {}

  removeListener(): void {}
}

const medias = new Map<string, FakeMedia>();

function media(query: string): FakeMedia {
  const existing = medias.get(query);
  if (existing !== undefined) return existing;
  const created = new FakeMedia(query);
  medias.set(query, created);
  return created;
}

function setMedia(query: string, matches: boolean): void {
  const target = media(query);
  target.matches = matches;
  act(() => {
    target.dispatchEvent(new Event("change"));
  });
}

function listenerCount(): number {
  let total = 0;
  for (const entry of medias.values()) total += entry.listeners.size;
  return total;
}

const DARK = "(prefers-color-scheme: dark)";
const MOTION = "(prefers-reduced-motion: reduce)";

function installMatchMedia(): void {
  window.matchMedia = (query: string) => media(query);
}

const root = document.documentElement;

function resetRoot(): void {
  root.classList.remove("dark", "high-contrast");
  root.style.fontSize = "";
  delete root.dataset["density"];
  delete root.dataset["font"];
  delete root.dataset["reducedMotion"];
}

function Providers({
  initial,
  children,
}: {
  readonly initial?: Partial<AppPreferences>;
  readonly children: ReactNode;
}) {
  const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES, ...initial });
  return (
    <BridgeProvider bridge={stub.bridge}>
      <PreferencesProvider>
        <DisplayPreferencesProvider>
          <ThemeProvider>
            <DensityProvider>
              <FontProvider>{children}</FontProvider>
            </DensityProvider>
          </ThemeProvider>
        </DisplayPreferencesProvider>
      </PreferencesProvider>
    </BridgeProvider>
  );
}

function Controls({
  onReady,
}: {
  readonly onReady: (api: ReturnType<typeof usePreferences>) => void;
}) {
  onReady(usePreferences());
  return null;
}

function mountApp(initial?: Partial<AppPreferences>) {
  let api: ReturnType<typeof usePreferences> | undefined;
  const view = render(
    <Providers {...(initial === undefined ? {} : { initial })}>
      <Controls onReady={(next) => (api = next)} />
    </Providers>,
  );
  return {
    view,
    set: (patch: Partial<AppPreferences>) => act(() => api?.setApp(patch)),
  };
}

describe("document root appearance", () => {
  beforeEach(() => {
    medias.clear();
    installMatchMedia();
    resetRoot();
  });
  afterEach(() => {
    cleanup();
    resetRoot();
  });

  it("applies density, font, text scale and reduced motion from the saved preferences", async () => {
    mountApp({
      interfaceDensity: "compact",
      font: "jakarta",
      textScale: 115,
      reducedMotion: "reduce",
    });
    await waitFor(() => expect(root.dataset["density"]).toBe("compact"));
    expect(root.dataset["font"]).toBe("jakarta");
    expect(root.style.fontSize).toBe("115%");
    expect(root.dataset["reducedMotion"]).toBe("reduce");
  });

  it("re-applies each setting when the preference changes", async () => {
    const app = mountApp();
    await waitFor(() => expect(root.dataset["density"]).toBe("comfortable"));
    app.set({ interfaceDensity: "compact", font: "jakarta", textScale: 90 });
    await waitFor(() => expect(root.dataset["density"]).toBe("compact"));
    expect(root.dataset["font"]).toBe("jakarta");
    expect(root.style.fontSize).toBe("90%");
    app.set({ reducedMotion: "reduce" });
    await waitFor(() => expect(root.dataset["reducedMotion"]).toBe("reduce"));
    app.set({ reducedMotion: "noPreference" });
    await waitFor(() => expect(root.dataset["reducedMotion"]).toBe("no-preference"));
  });

  it("toggles the dark and high-contrast classes with the theme", async () => {
    const app = mountApp({ theme: "dark" });
    await waitFor(() => expect(root.classList.contains("dark")).toBe(true));
    expect(root.classList.contains("high-contrast")).toBe(false);
    app.set({ theme: "highContrast" });
    await waitFor(() => expect(root.classList.contains("high-contrast")).toBe(true));
    expect(root.classList.contains("dark")).toBe(true);
    app.set({ theme: "light" });
    await waitFor(() => expect(root.classList.contains("dark")).toBe(false));
    expect(root.classList.contains("high-contrast")).toBe(false);
  });

  it("follows the system colour scheme only while the theme is system", async () => {
    const app = mountApp({ theme: "system" });
    await waitFor(() => expect(root.dataset["density"]).toBe("comfortable"));
    expect(root.classList.contains("dark")).toBe(false);
    setMedia(DARK, true);
    expect(root.classList.contains("dark")).toBe(true);
    setMedia(DARK, false);
    expect(root.classList.contains("dark")).toBe(false);

    app.set({ theme: "light" });
    await waitFor(() => expect(root.classList.contains("dark")).toBe(false));
    setMedia(DARK, true);
    expect(root.classList.contains("dark")).toBe(false);

    app.set({ theme: "system" });
    await waitFor(() => expect(root.classList.contains("dark")).toBe(true));
  });

  it("reports the resolved theme to consumers", async () => {
    setMedia(DARK, true);
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <BridgeProvider bridge={stub.bridge}>
          <PreferencesProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </PreferencesProvider>
        </BridgeProvider>
      ),
    });
    await waitFor(() => expect(result.current.resolvedTheme).toBe("dark"));
    setMedia(DARK, false);
    expect(result.current.resolvedTheme).toBe("light");
  });

  it("follows the system reduced-motion setting and lets an explicit choice win", async () => {
    const app = mountApp({ reducedMotion: "system" });
    await waitFor(() => expect(root.dataset["reducedMotion"]).toBe("no-preference"));
    setMedia(MOTION, true);
    expect(root.dataset["reducedMotion"]).toBe("reduce");
    app.set({ reducedMotion: "noPreference" });
    await waitFor(() => expect(root.dataset["reducedMotion"]).toBe("no-preference"));
    setMedia(MOTION, false);
    setMedia(MOTION, true);
    expect(root.dataset["reducedMotion"]).toBe("no-preference");
  });

  it("derives the effective reduced-motion value from the live media query", async () => {
    const stub = createPreferencesBridgeStub();
    const { result } = renderHook(() => useEffectiveReducedMotion(), {
      wrapper: ({ children }) => (
        <BridgeProvider bridge={stub.bridge}>
          <PreferencesProvider>{children}</PreferencesProvider>
        </BridgeProvider>
      ),
    });
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    expect(result.current).toBe(false);
  });

  it("removes every media listener on unmount", async () => {
    const app = mountApp({ theme: "system", reducedMotion: "system" });
    await waitFor(() => expect(root.dataset["density"]).toBe("comfortable"));
    expect(listenerCount()).toBeGreaterThan(0);
    app.view.unmount();
    expect(listenerCount()).toBe(0);
  });
});
